[
  {
    "logConfiguration": ${log_configuration},
    "portMappings": [
      {
        "protocol": "tcp",
        "containerPort": ${container_port}
      }
    ],
    "cpu": ${cpu},
    "memory": ${memory},
    "environment": ${environment},
    "image": "${docker_image_url}",
    "essential": true,
    "name": "${service_name}",
    "ulimits": [
      {
        "name": "nofile",
        "softLimit": ${ulimit_nofile},
        "hardLimit": ${ulimit_nofile}
      }
    ]
  }
]
