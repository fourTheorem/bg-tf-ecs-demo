variable "environment" {
  description = "Environment key for namespacing infrastructure"
  type        = string
}
variable "commit_sha" {
  description = "Git commit SHA related to the deployment"
  type        = string
}
variable "service_name" {
  description = "The name of this service"
  type        = string
  default     = "bg-tf-ecs-demo"
}
variable "build_number" {
  description = "The build number of the deployment"
  type        = string
}

locals {
  build_version_ref = replace(var.commit_sha, "\"", "")
  common_tags = {
    Application = var.service_name,
    Environment = var.environment,
    ManagedBy   = "Terraform",
  }
}

provider "aws" {
  region = "eu-west-1"

  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  alias  = "eu-west-1"
  region = "eu-west-1"

  default_tags {
    tags = local.common_tags
  }
}
