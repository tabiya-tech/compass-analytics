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


def _resolve_ref(openapi3: dict, ref: str) -> dict:
    """Resolve a local `#/components/schemas/Name` reference to its schema."""
    return openapi3.get('components', {}).get('schemas', {}).get(ref.split('/')[-1], {})


#: The only `type` values Swagger 2.0 allows on a non-body parameter. Anything else
#: (notably `object`, which is what FastAPI emits for a Pydantic-model query parameter,
#: i.e. `Annotated[Model, Query()]`) has no Swagger 2.0 equivalent, and GCP rejects the
#: whole config with an opaque "Cannot convert to service config" 400. Declare such a
#: parameter as individual query params instead — see `AnalyticsFiltersDep` in the backend.
SWAGGER2_PARAM_TYPES = frozenset({'string', 'number', 'integer', 'boolean', 'array', 'file'})

#: Keys of an OpenAPI path item that are operations; anything else (`parameters`,
#: `summary`, `servers`, ...) is not a method and must not be walked as one.
HTTP_METHODS = frozenset({'get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'})


def _swagger_param_fields(schema: dict, openapi3: dict) -> dict:
    """
    Translate an OpenAPI 3 parameter `schema` into the Swagger 2.0 fields that live
    directly on the parameter object (`type`, `items`, `collectionFormat`, `enum`).

    An array parameter *must* carry `items` — Swagger 2.0 has no untyped array. Without
    it, GCP's service-config translator models the parameter as a google.protobuf.Struct
    /ListValue and then rejects the config with "repeated message field ... cannot be
    mapped as an HTTP parameter".
    """
    if '$ref' in schema:
        schema = _resolve_ref(openapi3, schema['$ref'])

    if 'anyOf' in schema:
        # Nullable types (e.g. Optional[str] → anyOf: [{type: string}, {type: null}]).
        # Keep the first non-null branch — Swagger 2.0 has no union type.
        for entry in schema['anyOf']:
            if entry.get('type') == 'null':
                continue
            fields = _swagger_param_fields(entry, openapi3)
            if fields:
                return fields
        return {}

    if 'type' not in schema:
        return {}

    fields = {'type': schema['type']}
    if 'enum' in schema:
        fields['enum'] = schema['enum']
    if schema['type'] == 'array':
        # Fall back to a string item rather than emitting an array without `items`.
        fields['items'] = _swagger_param_fields(schema.get('items', {}), openapi3) or {'type': 'string'}
    return fields


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
        for method in [m for m in openapi3['paths'][path] if m in HTTP_METHODS]:

            # OpenAPI 3 and OpenAPI 2 has different way to handle the schema/type
            for param in openapi3['paths'][path][method].get('parameters', []):
                schema = param.pop('schema', None) or {}
                fields = _swagger_param_fields(schema, openapi3)
                # Every non-body Swagger 2.0 parameter needs a type; string is the safe default.
                param.update(fields or {'type': 'string'})
                if param['type'] not in SWAGGER2_PARAM_TYPES:
                    raise ValueError(
                        f"{method.upper()} {path}: parameter '{param.get('name')}' has type "
                        f"'{param['type']}', which Swagger 2.0 does not allow on a non-body "
                        f"parameter (allowed: {', '.join(sorted(SWAGGER2_PARAM_TYPES))}). "
                        "Declare it as individual primitive query parameters in the backend "
                        "instead of a single model-typed one."
                    )
                if param['type'] == 'array' and param.get('in') in ('query', 'formData'):
                    # FastAPI reads repeated query params (`?x=a&x=b`), not comma-joined ones.
                    param['collectionFormat'] = 'multi'

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
        for method in [m for m in openapi3['paths'][path] if m in HTTP_METHODS]:
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
