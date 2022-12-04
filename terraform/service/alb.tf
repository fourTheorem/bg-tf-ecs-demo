resource "aws_security_group" "alb" {
  name   = "${var.service_name}-alb-sg-${var.environment}"
  vpc_id = local.vpc_id
}

resource "aws_security_group_rule" "alb_ingress_http" {
  type              = "ingress"
  security_group_id = aws_security_group.alb.id
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "http access from world to alb"
}

resource "aws_security_group_rule" "alb_egress" {
  type              = "egress"
  security_group_id = aws_security_group.alb.id
  from_port         = 0
  to_port           = 0
  protocol          = -1
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "access from alb to world"
}

resource "aws_lb" "api" {
  name                       = "${var.service_name}-alb-${var.environment}"
  internal                   = false
  load_balancer_type         = "application"
  enable_deletion_protection = false
  security_groups            = [aws_security_group.alb.id]
  subnets                    = split(",", local.vpc_private_subnets)
}

resource "aws_lb_target_group" "tg" {
  for_each                      = toset(local.stack_refs)
  name                          = "${var.service_name}-${each.value}-${var.environment}"
  port                          = "80"
  protocol                      = "HTTP"
  vpc_id                        = local.vpc_id
  target_type                   = "ip"
  deregistration_delay          = "10"
  slow_start                    = "0"
  load_balancing_algorithm_type = "least_outstanding_requests"
  stickiness {
    type    = "lb_cookie"
    enabled = false
  }

  health_check {
    enabled             = true
    interval            = 30
    path                = var.api_healthcheck_path
    timeout             = 29
    healthy_threshold   = 3
    unhealthy_threshold = 2
    matcher             = "200"
  }

  depends_on = [aws_lb.api]
}

resource "aws_lb_listener" "api_http" {
  load_balancer_arn = aws_lb.api.arn
  port              = "80"
  protocol          = "HTTP"

  lifecycle {
    ignore_changes = [default_action]
  }

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg["a"].arn
  }
}

resource "aws_lb_listener" "api_http_testing" {
  load_balancer_arn = aws_lb.api.arn
  port              = "8080"
  protocol          = "HTTP"

  lifecycle {
    ignore_changes = [default_action]
  }

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg["b"].arn
  }
}
