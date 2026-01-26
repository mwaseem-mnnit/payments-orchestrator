locals {
  output_vpc_id = (
    var.use_existing_vpc
    ? var.existing_vpc_id
    : aws_vpc.this[0].id
  )

  output_vpc_cidr = (
    var.use_existing_vpc
    ? data.aws_vpc.existing[0].cidr_block
    : var.vpc_cidr
  )

  output_private_subnet_ids = (
    var.use_existing_vpc
    ? var.existing_private_subnet_ids
    : [for subnet in aws_subnet.private : subnet.id]
  )

  output_public_subnet_ids = (
    var.use_existing_vpc
    ? var.existing_public_subnet_ids
    : [for subnet in aws_subnet.public : subnet.id]
  )

  output_availability_zones = var.availability_zones
}

output "vpc_id" {
  value = local.output_vpc_id
}

output "vpc_cidr" {
  value = local.output_vpc_cidr
}

output "private_subnet_ids" {
  value = local.output_private_subnet_ids
}

output "public_subnet_ids" {
  value = local.output_public_subnet_ids
}

output "availability_zones" {
  value = local.output_availability_zones
}

