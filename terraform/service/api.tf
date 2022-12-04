variable "api_healthcheck_path" {
  description = "The route that the lambda should healthcheck on"
  type        = string
  default     = "/health"
}

locals {
  api_docker_image_url = format(
    "%s:%s",
    var.ecr_repo_url,
    "api-${var.commit_hash}"
  )
}

output "regional_service_url" {
  value = aws_lb.api.dns_name
}

module "api_service" {
  source           = "../ecs-fargate-service"
  network_mode     = "awsvpc"
  subnets          = split(",", local.vpc_private_subnets)
  assign_public_ip = true
  security_groups  = [aws_security_group.alb.id]
  vpc_id           = local.vpc_id
  service_name     = "${var.service_name}-api"
  aws_region       = data.aws_region.current.name
  cluster_name     = var.ecs_cluster_name
  environment      = var.environment
  environment_variables = merge(local.default_environment_variables, {
    HEALTHCHECK_PATH       = var.api_healthcheck_path
    BG_TARGET_STACK        = "a"
    DYNAMO_DB_TABLE_NAME_A = aws_dynamodb_table.data_table["a"].name
    DYNAMO_DB_TABLE_NAME_B = aws_dynamodb_table.data_table["b"].name
  })
  container_port   = 8080
  ulimit_nofile    = 2048
  docker_image_url = local.api_docker_image_url
  memory           = 512
  cpu              = 256
  target_group_arn = local.next_stack_ref == "a" ? aws_lb_target_group.tg["b"].arn : aws_lb_target_group.tg["a"].arn
  policies = [
    {
      Action = [
        "dynamodb:GetItem",
      ]
      Resource = [
        aws_dynamodb_table.data_table["a"].arn,
        aws_dynamodb_table.data_table["b"].arn,
      ]
      Effect = "Allow"
    }
  ]
}
