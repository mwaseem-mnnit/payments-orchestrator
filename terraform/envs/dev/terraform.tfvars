aws_region = "us-east-1"
name_prefix = "env-dev"
tags = {
  environment = "dev"
}
create_mode = true

existing_vpc_id = "vpc-01dc2f18b63863ed4"
existing_private_subnet_ids = [
  "subnet-01c5f106c41ea8790",
  "subnet-08cb761929ffea701"
]
existing_public_subnet_ids = [
  "subnet-01c5f106c41ea8790",
  "subnet-08cb761929ffea701"
]
availability_zones = [
  "us-east-1a",
  "us-east-1b"
]

cluster_name = "payments-dev"
kubernetes_version = "1.30"
endpoint_public_access = true
endpoint_private_access = false
node_groups = {
  default = {
    instance_types = ["t3.micro"]
    desired_size   = 1
    min_size       = 1
    max_size       = 1
    disk_size      = 20
    capacity_type  = "SPOT"
  }
}
