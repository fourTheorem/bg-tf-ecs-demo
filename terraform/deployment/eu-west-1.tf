data "aws_ecr_repository" "demo_repo_euw1" {
  provider = aws.eu-west-1
  name     = "demo-repository-${var.environment}"
}

data "aws_ecs_cluster" "demo_cluster_euw1" {
  provider     = aws.eu-west-1
  cluster_name = "demo-cluster-${var.environment}"
}

module "app_eu_west_1" {
  source = "../service"

  providers = {
    aws = aws.eu-west-1
  }

  commit_hash      = local.build_version_ref
  build_number     = var.build_number
  ecr_repo_url     = data.aws_ecr_repository.demo_repo_euw1.repository_url
  ecs_cluster_name = data.aws_ecs_cluster.demo_cluster_euw1.cluster_name
  environment      = var.environment
  service_name     = var.service_name
}

output "regional_service_url_eu_west_1" {
  value = module.app_eu_west_1.regional_service_url
}
