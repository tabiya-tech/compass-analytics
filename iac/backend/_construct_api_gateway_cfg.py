import os
import subprocess

import pulumi
import requests
import yaml

from lib import Version


def get_id_token(audience: str) -> str:
    """
    Get an OIDC ID token for the given audience by impersonating the deploy service account.

    The deploy SA must have roles/iam.serviceAccountTokenCreator on itself so it can
    impersonate itself to obtain an identity token under WIF credentials (which don't
    support fetch_id_token or google.auth.default() inside Pulumi apply callbacks).
    """
    deploy_sa = os.environ.get("DEPLOY_SERVICE_ACCOUNT", "")
    if not deploy_sa:
        raise ValueError("DEPLOY_SERVICE_ACCOUNT env var is not set — cannot obtain an ID token for Cloud Run")

    result = subprocess.run(
        [
            "gcloud", "auth", "print-identity-token",
            f"--impersonate-service-account={deploy_sa}",
            f"--audiences={audience}",
            "--include-email",
        ],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def _get_open_api_config(cloud_run_url: str, id_token: str) -> dict:
    response = requests.get(
        f"{cloud_run_url}/api/openapi.json",
        headers={"Authorization": f"Bearer {id_token}"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def _convert_open_api_3_to_2(openapi3: dict):
    """
    Convert OpenAPI 3.1 to OpenAPI 2.0 format for GCP API Gateway configuration.

    :param openapi3: Open API 3.1 specification as a dictionary.
    :return:
    """
    current_dir = os.path.dirname(__file__)

    # Open the OpenAPI 2.0 template
    template_file = os.path.join(current_dir, 'openapi2_template.yaml')
    with open(template_file, 'r') as f:
        openapi2 = yaml.load(f, Loader=yaml.SafeLoader)

    # Transform the OpenAPI 3.1 to OpenAPI 2.0
    for path in openapi3['paths']:
        for method in openapi3['paths'][path]:

            # OpenAPI 3 and OpenAPI 2 has different way to handle the schema/type
            if 'parameters' in openapi3['paths'][path][method]:
                for param in openapi3['paths'][path][method]['parameters']:
                    schema = param.pop('schema', {'type': None})
                    if schema:
                        if 'type' in schema:
                            param['type'] = schema['type']
                        elif 'anyOf' in schema:
                            # Handle nullable types (e.g. Optional[str] → anyOf: [{type: string}, {type: null}])
                            # Pick the first non-null type for Swagger 2.0 compatibility.
                            # If the non-null entry is a $ref (e.g. Optional[SomeEnum]), resolve it
                            # from components/schemas and inline the enum values with type: string.
                            non_null_entries = [s for s in schema['anyOf'] if s.get('type') != 'null']
                            for entry in non_null_entries:
                                if 'type' in entry:
                                    param['type'] = entry['type']
                                    break
                                elif '$ref' in entry:
                                    ref_name = entry['$ref'].split('/')[-1]
                                    ref_schema = openapi3.get('components', {}).get('schemas', {}).get(ref_name, {})
                                    param['type'] = ref_schema.get('type', 'string')
                                    if 'enum' in ref_schema:
                                        param['enum'] = ref_schema['enum']
                                    break

            # Add quota/rate-limiter
            metric_costs = {'metricCosts': {}}  # set the default value
            metric_costs['metricCosts']['request-metric'] = 1
            openapi3['paths'][path][method]['x-google-quota'] = metric_costs

            # remove response contents as not required in GCP API Gateway configs
            if 'responses' in openapi3['paths'][path][method]:
                for response in openapi3['paths'][path][method]['responses']:
                    openapi3['paths'][path][method]['responses'][response].pop('content', None)

            # remove response contents as not required in GCP API Gateway configs
            if 'requestBody' in openapi3['paths'][path][method]:
                openapi3['paths'][path][method].pop('requestBody')

    # Add OPTIONS method to every path so the API Gateway passes CORS preflight
    # requests through to Cloud Run, which handles CORS via CORSMiddleware.
    # Path parameters must be declared on OPTIONS too or the gateway rejects the config.
    for path in openapi3['paths']:
        # Collect path parameters from any existing method on this path
        path_params = []
        for method in openapi3['paths'][path]:
            params = openapi3['paths'][path][method].get('parameters', [])
            for param in params:
                if param.get('in') == 'path' and not any(p['name'] == param['name'] for p in path_params):
                    path_params.append({'name': param['name'], 'in': 'path', 'required': True, 'type': param.get('type', 'string')})
        options_entry = {
            'operationId': f"cors_preflight_{path.replace('/', '_').strip('_')}",
            'summary': 'CORS preflight',
            'x-google-quota': {'metricCosts': {'request-metric': 1}},
            'responses': {'200': {'description': 'CORS preflight response'}},
        }
        if path_params:
            options_entry['parameters'] = path_params
        openapi3['paths'][path]['options'] = options_entry

    openapi2['paths'].update(openapi3['paths'])

    return openapi2


def construct_api_gateway_cfg(*,
                              cloud_run_url: str,
                              id_token_str: str,
                              expected_version: Version) -> str:
    """
    Construct the API Gateway configuration by fetching the OpenAPI spec from the
    already-deployed Cloud Run service.

    Called eagerly in deploy_backend() before any Pulumi apply() callback — the
    cloud_run_url and id_token_str are resolved plain strings by that point.
    """
    pulumi.info("Constructing API Gateway configuration...")
    pulumi.info(f"cloud_run_url: {cloud_run_url}")

    openapi3 = _get_open_api_config(cloud_run_url, id_token_str)

    yaml_config = yaml.dump(_convert_open_api_3_to_2(openapi3),
                            None,
                            encoding='utf-8',
                            allow_unicode=True,
                            indent=2)

    return yaml_config.decode('utf-8')
