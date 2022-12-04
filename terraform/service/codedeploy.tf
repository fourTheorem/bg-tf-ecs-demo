resource "aws_codedeploy_app" "ecs" {
  compute_platform = "ECS"
  name             = "${var.service_name}-ecs-${var.environment}"
}

resource "aws_iam_role" "codedeploy" {
  name = "${var.service_name}-codedeploy-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_ecs" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
  depends_on = [aws_iam_role.codedeploy]
}

resource "aws_codedeploy_deployment_group" "codedeploy_ecs_api" {
  app_name              = aws_codedeploy_app.ecs.name
  deployment_group_name = module.api_service.ecs_service_name
  service_role_arn      = aws_iam_role.codedeploy.arn

  deployment_config_name = "CodeDeployDefault.ECSAllAtOnce"

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  auto_rollback_configuration {
    enabled = false
    events  = ["DEPLOYMENT_FAILURE"]
  }

  ecs_service {
    cluster_name = var.ecs_cluster_name
    service_name = module.api_service.ecs_service_name
  }

  blue_green_deployment_config {
    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 0
    }
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [aws_lb_listener.api_http.arn]
      }

      test_traffic_route {
        listener_arns = [aws_lb_listener.api_http_testing.arn]
      }

      target_group {
        name = aws_lb_target_group.a.name
      }

      target_group {
        name = aws_lb_target_group.b.name
      }
    }
  }
}

module "codedeploy_ecs_init_lambda" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "~> 4.0"

  function_name            = "${var.service_name}-codedeploy-ecs-init-${var.environment}"
  description              = "Initiate a CodeDeploy deployment to the ECS service"
  handler                  = "index-main.handler"
  runtime                  = "nodejs16.x"
  timeout                  = 30
  architectures            = ["arm64"]
  attach_policy_statements = true
  policy_statements = {
    codedeploy = {
      effect = "Allow",
      actions = [
        "codedeploy:Batch*",
        "codedeploy:CreateDeployment",
        "codedeploy:Get*",
        "codedeploy:List*",
        "codedeploy:RegisterApplicationRevision"
      ],
      resources = ["*"]
    },
    ecs = {
      effect = "Allow",
      actions = [
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ssm:GetParameter",
      ],
      resources = ["*"]
    },
    iam = {
      effect    = "Allow",
      actions   = ["iam:PassRole"],
      resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/*"]
    },
  }

  source_path = "${path.module}/../../packages/codedeploy-init/dist"
}

locals {
  hook_lambdas = {
    "BeforeAllowTraffic" = "${var.service_name}-codedeploy-before-traffic-hook-${var.environment}",
    "AfterAllowTraffic"  = "${var.service_name}-codedeploy-after-traffic-hook-${var.environment}",
  }
}

module "codedeploy_hook_lambda" {
  for_each = local.hook_lambdas

  source  = "terraform-aws-modules/lambda/aws"
  version = "~> 4.0"

  function_name            = each.value
  description              = "CodeDeploy hook to perform ${each.key} task"
  handler                  = "index-main.handler"
  runtime                  = "nodejs16.x"
  timeout                  = 900
  architectures            = ["arm64"]
  hash_extra               = each.key
  attach_policy_statements = true
  environment_variables = {
    LIFECYCLE_EVENT       = each.key
    ACTIVE_STACK_SSM_NAME = data.aws_ssm_parameter.active_stack.name
  }
  policy_statements = {
    codedeploy = {
      effect = "Allow",
      actions = [
        "codedeploy:PutLifecycleEventHookExecutionStatus",
      ],
      resources = ["*"]
    },
    ssm = {
      effect = "Allow",
      actions = [
        "ssm:GetParameter",
        "ssm:PutParameter",
      ],
      resources = [data.aws_ssm_parameter.active_stack.arn]
    },
  }

  source_path = "${path.module}/../../packages/codedeploy-hooks/dist"
}

resource "aws_cloudformation_stack" "codedeploy_ecs" {
  name               = module.api_service.ecs_service_name
  timeout_in_minutes = "15"

  template_body = jsonencode({
    Description = "CodeDeploy ECS Service deployment initiation by Terraform"
    Resources = {
      CodeDeployEcsLambda = {
        Type = "Custom::ExecuteLambda",
        Properties = {
          ServiceToken            = module.codedeploy_ecs_init_lambda.lambda_function_arn
          DeploymentId            = aws_codedeploy_deployment_group.codedeploy_ecs_api.deployment_group_id
          build                   = var.build_number
          appName                 = aws_codedeploy_app.ecs.name
          serviceName             = module.api_service.ecs_service_name
          deploymentGroupName     = aws_codedeploy_deployment_group.codedeploy_ecs_api.deployment_group_name
          cluster                 = var.ecs_cluster_name
          containerName           = "${var.service_name}-api"
          containerPort           = var.api_container_port
          containerDefinitions    = module.api_service.ecs_container_definitions
          taskFamily              = module.api_service.ecs_service_name
          taskRoleArn             = module.api_service.task_role_arn
          taskExecutionRoleArn    = module.api_service.execution_role_arn
          network_mode            = "awsvpc"
          requiresCompatibilities = ["FARGATE"]
          hooks                   = jsonencode([for hook, fnName in local.hook_lambdas : { "${hook}" = fnName }])
        }
      },
    }
    Outputs = {
      deployment = {
        Value = {
          "Fn::GetAtt" = [
            "CodeDeployEcsLambda",
            "deployment"
          ]
        }
      }
      build = {
        Value = {
          "Fn::GetAtt" = [
            "CodeDeployEcsLambda",
            "build"
          ]
        }
      }
  } })

  lifecycle {
    ignore_changes = [disable_rollback]
  }

  depends_on = [
    aws_codedeploy_deployment_group.codedeploy_ecs_api,
    module.codedeploy_hook_lambda,
    module.api_service
  ]
}
