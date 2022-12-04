variable "service_name" {
  description = "The name of the service"
  type        = string
}

variable "aws_region" {
  description = "The region in which to deploy the lambda function"
  type        = string
}
variable "environment" {
  description = "The deployment namespace, e.g. eg dev, stage, prod"
  type        = string
}

variable "cluster_name" {
  description = "The name of the cluster the service is deployed to"
  type        = string
}

variable "environment_variables" {
  description = "The list of environment variables in the container definition for the task"
  type        = map(string)
  default     = {}
}

variable "container_port" {
  description = "The port number that a container in the task listens on for LB to route traffic to"
  type        = number
  default     = 8080
}

variable "docker_image_url" {
  description = "The full Docker Image URL (includes tag as well)"
  type        = string
}

variable "memory" {
  description = "Task memory limit in MB"
  type        = number
  default     = 128
}

variable "cpu" {
  description = "Task CPU limit in units"
  type        = number
  default     = 256
}

variable "target_group_arn" {
  description = "One target group ARN to associate the service with"
  type        = string
}

variable "placement_strategy_type" {
  description = "The type of placement strategy. The random placement strategy randomly places tasks on available candidates. The spread placement strategy spreads placement across available candidates evenly based on the field parameter. The binpack strategy places tasks on available candidates that have the least available amount of the resource that is specified with the field parameter. For example, if you binpack on memory, a task is placed on the instance with the least amount of remaining memory (but still enough to run the task)."
  type        = string
  default     = "spread"
}

variable "placement_strategy_field" {
  description = "The field to apply the placement strategy against. For the spread placement strategy, valid values are instanceId (or host, which has the same effect), or any platform or custom attribute that is applied to a container instance, such as attribute:ecs.availability-zone. For the binpack placement strategy, valid values are cpu and memory. For the random placement strategy, this field is not used."
  type        = string
  default     = "attribute:ecs.availability-zone"
}

variable "ulimit_nofile" {
  description = "Sets the Linux ulimit on number of file descriptors both hard and soft limits, defaults to 1024."
  type        = string
  default     = 1024
}

variable "network_mode" {
  description = "The networking mode, either 'bridge' or 'awsvpc'. To use IP type target group, you must use 'awsvpc'"
  default     = "bridge"
  type        = string
}

variable "assign_public_ip" {
  description = "Assign a public IP address to the ENI"
  type        = bool
  default     = false
}

variable "policies" {
  description = "List of objects defining IAM policy statements"
  type = list(object({
    Action   = list(string)
    Resource = list(string)
    Effect   = string
  }))
  default = []
}

variable "ecs_desired_tasks" {
  description = "Desired number of api containers to run per region"
  type        = number
  default     = 2
}

variable "log_retention" {
  description = "Time in days to retain logs for"
  type        = number
  default     = 3
}

variable "subnets" {
  description = "The subnets associated with the task or service"
  type        = list(string)
  default     = []
}

variable "security_groups" {
  description = "The security groups associated with the task or service"
  type        = list(string)
  default     = null
}

variable "vpc_id" {
  description = "The VPC Id"
  type        = string
  default     = ""
}

variable "ordered_placement_strategy" {
  description = "Task placement strategy"
  type = list(object({
    type  = string
    field = string
  }))
  default = []
}

variable "ecs_delete_timeout" {
  description = "The amount of time to wait for connections to drain on ecs service destroy"
  default     = "30m"
  type        = string
}
