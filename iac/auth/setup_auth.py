import pulumi
import pulumi_gcp as gcp
from environment.env_types import EnvironmentTypes

import os
import sys

libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, libs_dir)

from lib import get_resource_name, get_project_base_config
from identity_platform import IdentityPlatform


def _setup_google_signin(*,
                         basic_config,
                         frontend_domain: pulumi.Output[str],
                         gcp_oauth_client_id: str,
                         gcp_oauth_client_secret: str,
                         dependencies: list[pulumi.Resource]):
    gcp.identityplatform.DefaultSupportedIdpConfig(
        get_resource_name(resource="google-idp", resource_type="config"),
        client_id=gcp_oauth_client_id,
        client_secret=gcp_oauth_client_secret,
        idp_id="google.com",
        enabled=True,
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )


def _setup_identity_platform(*,
                              basic_config,
                              environment_type: pulumi.Output[str],
                              frontend_domain: pulumi.Output[str],
                              dependencies: list[pulumi.Resource]) -> IdentityPlatform:
    def _get_authorized_domains(args) -> list[str]:
        _frontend_domain = args[0]
        _environment_type = args[1]
        _authorized_domains = [_frontend_domain]
        if _environment_type == EnvironmentTypes.DEV.value:
            _authorized_domains.append("localhost")
        return _authorized_domains

    authorized_domains = pulumi.Output.all(frontend_domain, environment_type).apply(_get_authorized_domains)

    idp_config = IdentityPlatform(
        get_resource_name(resource="identity-platform", resource_type="default-config"),
        config=gcp.identityplatform.ConfigArgs(
            authorized_domains=authorized_domains,
            mfa=gcp.identityplatform.ConfigMfaArgs(
                state="DISABLED",
            ),
            sign_in=gcp.identityplatform.ConfigSignInArgs(
                allow_duplicate_emails=False,
                anonymous=gcp.identityplatform.ConfigSignInAnonymousArgs(
                    enabled=False,
                ),
                email=gcp.identityplatform.ConfigSignInEmailArgs(
                    enabled=True,
                    password_required=True,
                ),
            ),
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider,
                                    depends_on=dependencies,
                                    delete_before_replace=True)
    )

    api_key_value = idp_config.client.apply(lambda c: c.get("api_key"))
    auth_domain = idp_config.client.apply(lambda c: f"{c.get('firebase_subdomain')}.firebaseapp.com")
    pulumi.export("identity_platform_client_api_key", api_key_value)
    pulumi.export("firebase_auth_domain", auth_domain)
    return idp_config


def deploy_auth(*,
                location: str,
                environment_type: pulumi.Output[str],
                project: pulumi.Output[str],
                frontend_domain: pulumi.Output[str],
                gcp_oauth_client_id: str,
                gcp_oauth_client_secret: str):
    """
    Deploy Firebase/Identity Platform auth for the analytics app.

    Enables Email/Password and Google sign-in. No anonymous auth, no custom email domain,
    no auth.* subdomain — analytics needs less than compass.
    """
    _basic_config = get_project_base_config(
        project=project,
        location=location,
    )

    idp_cfg = _setup_identity_platform(
        basic_config=_basic_config,
        environment_type=environment_type,
        frontend_domain=frontend_domain,
        dependencies=[]
    )

    _setup_google_signin(
        basic_config=_basic_config,
        frontend_domain=frontend_domain,
        gcp_oauth_client_id=gcp_oauth_client_id,
        gcp_oauth_client_secret=gcp_oauth_client_secret,
        dependencies=[idp_cfg]
    )
