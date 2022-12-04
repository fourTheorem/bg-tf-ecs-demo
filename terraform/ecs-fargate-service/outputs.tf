output "ecs_service_name" {
  description = "The name of the ECS service"
  value       = local.namespaced_name
}

output "ecs_container_definitions" {
  description = "Container definitions for CodeDeploy use"
  value       = local.container_definitions
}

output "execution_role_arn" {
  description = "ARN for the service execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "task_role_arn" {
  description = "ARN for the service task role"
  value       = aws_iam_role.ecs_task.arn
}

output "log_group_name" {
  description = "Name of the log group that the task will write to"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "log_group_arn" {
  description = "ARN of the log group that the task will write to"
  value       = aws_cloudwatch_log_group.ecs.arn
}
