locals {
  cluster_service_name = "${var.cluster_name}-${var.service_name}"
  namespaced_name      = "${var.service_name}-${var.environment}"
  type_name            = "ecs-fargate"

  log_group_name = "/aws/ecs/${var.cluster_name}/${var.service_name}/${var.environment}"

  container_definitions = templatefile(
    "${path.module}/container-definitions/task-container-definitions-template.tpl",
    {
      docker_image_url = var.docker_image_url
      environment      = jsonencode(local.environment_vars_array)
      log_configuration = jsonencode({
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = var.environment
        }
      })
      service_name   = var.service_name
      container_port = var.container_port
      cpu            = var.cpu
      memory         = var.memory
      ulimit_nofile  = var.ulimit_nofile
    }
  )

  environment_vars_array = [for k, v in merge({ AWS_REGION = var.aws_region }, var.environment_variables) : {
    name  = k,
    value = v
  }]
}

