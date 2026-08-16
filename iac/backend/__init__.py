# Required services for the backend module
# These should be enabled when a new environment is created.
# NOTE: compute.googleapis.com, serviceusage.googleapis.com and cloudresourcemanager.googleapis.com
# are already enabled as initial APIs by the environment stack, so they must not be listed here.
REQUIRED_SERVICES = [
    # GCP Cloud Run
    "run.googleapis.com",
    # GCP API Gateway
    "apigateway.googleapis.com",
    # Service Control - required by API Gateway managed services
    "servicecontrol.googleapis.com",
    # Service Management - required by API Gateway managed services
    "servicemanagement.googleapis.com",
    # GCP Artifact Registry (for pulling the backend docker image)
    "artifactregistry.googleapis.com",
    # Serverless VPC Access (for the Cloud Run NAT gateway egress)
    "vpcaccess.googleapis.com",
]
