variable "live_lambda_alias" {
  description = "The alias to use for the live lambda"
  type        = string
  default     = "live"
}

module "data_ingestor_lambda" {
  for_each = toset(local.stack_refs)

  source  = "terraform-aws-modules/lambda/aws"
  version = "~> 4.0"

  function_name            = "${var.service_name}-data-ingestor-${each.value}-${var.environment}"
  description              = "Lambda to ingest test data into dynamo into stack ${each.value}"
  handler                  = "index-main.handler"
  runtime                  = "nodejs18.x"
  timeout                  = 30
  architectures            = ["arm64"]
  hash_extra               = each.value
  attach_policy_statements = true
  publish                  = true
  environment_variables = merge(local.default_environment_variables, {
    DYNAMO_DB_TABLE_NAME = aws_dynamodb_table.data_table[each.value].name
  })
  policy_statements = {
    codedeploy = {
      effect = "Allow",
      actions = [
        "dynamodb:PutItem",
      ],
      resources = [
        aws_dynamodb_table.data_table[each.value].arn
      ]
    },
  }

  source_path = "${path.module}/../../packages/data-ingestor/dist"
}

data "aws_lambda_alias" "current_live_ingestor_a" {
  function_name = module.data_ingestor_lambda["a"].lambda_function_name
  name          = var.live_lambda_alias
}

data "aws_lambda_alias" "current_live_ingestor_b" {
  function_name = module.data_ingestor_lambda["b"].lambda_function_name
  name          = var.live_lambda_alias
}

resource "aws_cloudwatch_event_rule" "cron" {
  for_each            = toset(local.stack_refs)
  is_enabled          = true
  name                = "${var.service_name}-data-ingestor-cron-${each.value}-${var.environment}"
  description         = "Schedule for triggering data-ingestor lambda for stack ref ${each.value}"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "cron_target" {
  for_each = toset(local.stack_refs)
  rule     = aws_cloudwatch_event_rule.cron[each.value].name
  arn      = "${module.data_ingestor_lambda[each.value].lambda_function_arn}:${var.live_lambda_alias}"
}

resource "aws_lambda_permission" "cron_data_ingestor" {
  for_each      = toset(local.stack_refs)
  statement_id  = "AllowExecutionFromCloudWatch-${each.value}"
  action        = "lambda:InvokeFunction"
  function_name = "${module.data_ingestor_lambda[each.value].lambda_function_arn}:${var.live_lambda_alias}"
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cron[each.value].arn
  depends_on    = [module.data_ingestor_lambda]
}
