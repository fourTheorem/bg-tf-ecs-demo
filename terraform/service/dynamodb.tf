resource "aws_dynamodb_table" "data_table" {
  for_each     = toset(local.stack_refs)
  name         = "${var.service_name}-data-${each.value}-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  lifecycle {
    ignore_changes = all // supports blue/green databases
  }
}
