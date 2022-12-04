variable "commit_hash" {
  description = "Commit hash from latest commit"
  type        = string
}
variable "build_number" {
  description = "The build number of the deployment"
  type        = string
}
variable "environment" {
  description = "Which environment to deploy to"
  type        = string
}
variable "service_name" {
  description = "The name of this service"
  type        = string
}
variable "ecr_repo_url" {
  description = "ECR repo URL to deploy API image from"
  type        = string
}
variable "ecs_cluster_name" {
  description = "Name of the ECS cluster to deploy the service to"
  type        = string
}

locals {
  stack_refs = ["a", "b"]
  log_level  = var.environment == "dev" ? "DEBUG" : "INFO"

  default_environment_variables = {
    LOG_LEVEL   = local.log_level
    ENVIRONMENT = var.environment
    REGION      = data.aws_region.current.name
  }

  vpc_id = data.aws_vpcs.demo_vpc.ids[0]
  vpc_private_subnets = join(
    ",",
    data.aws_subnets.vpc_private_subnets.ids,
  )

  active_stack_param_name = "${var.service_name}-active-stack-${var.environment}"
  next_stack_ref          = data.aws_ssm_parameter.active_stack.value == "a" ? "b" : "a"
}

resource "aws_ssm_parameter" "active_stack" {
  name  = local.active_stack_param_name
  type  = "String"
  value = "a"

  lifecycle {
    ignore_changes = all
  }
}

data "aws_ssm_parameter" "active_stack" {
  name       = local.active_stack_param_name
  depends_on = [aws_ssm_parameter.active_stack]
}

data "aws_vpcs" "demo_vpc" {
  filter {
    name   = "demo-vpc"
    values = ["true"]
  }
}

data "aws_subnets" "vpc_private_subnets" {
  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
  filter {
    name   = "type"
    values = ["private"]
  }
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}


