data "aws_iam_policy_document" "assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    effect = "Allow"
  }
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.service_name}-${var.aws_region}-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.assume_role_policy.json
}

resource "aws_iam_policy" "ecs_task" {
  name        = "${var.service_name}-${var.aws_region}-${var.environment}"
  description = "IAM Policy for the ${var.service_name} service"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": ${jsonencode(var.policies)}
}
EOF
}

resource "aws_iam_role_policy_attachment" "ecs_task_custom" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_task.arn
  depends_on = [aws_iam_role.ecs_task]
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.service_name}-execution-${var.aws_region}-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.assume_role_policy.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_basics" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  depends_on = [aws_iam_role.ecs_task_execution]
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = local.log_group_name
  retention_in_days = var.log_retention
}

resource "aws_ecs_task_definition" "codedeploy" {
  family                   = local.namespaced_name
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  container_definitions    = local.container_definitions
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  network_mode             = var.network_mode

  lifecycle {
    ignore_changes = [container_definitions]
  }
}
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.service_name}-${var.aws_region}-${var.environment}-sg"
  description = "allow inbound access from only the alb"
  vpc_id      = var.vpc_id

  ingress {
    protocol        = "tcp"
    from_port       = 8080
    to_port         = 8080
    security_groups = var.security_groups
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_service" "codedeploy" {
  name           = local.namespaced_name
  cluster        = var.cluster_name
  launch_type    = "FARGATE"
  propagate_tags = "SERVICE"

  task_definition                   = aws_ecs_task_definition.codedeploy.arn
  desired_count                     = var.ecs_desired_tasks
  health_check_grace_period_seconds = "900"

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.service_name
    container_port   = var.container_port
  }

  deployment_controller {
    type = "CODE_DEPLOY"
  }

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = var.subnets
    assign_public_ip = true
  }

  dynamic "ordered_placement_strategy" {
    for_each = var.ordered_placement_strategy
    content {
      type  = ordered_placement_strategy.value["type"]
      field = ordered_placement_strategy.value["field"]
    }
  }

  lifecycle {
    ignore_changes = [
      task_definition,
      desired_count,
      load_balancer,
    ]
  }
  timeouts {
    delete = var.ecs_delete_timeout
  }
}
