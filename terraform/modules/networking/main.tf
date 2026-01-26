locals {
  create_mode = var.use_existing_vpc == false

  public_subnet_map = local.create_mode ? {
    for idx, cidr in var.public_subnet_cidrs : idx => {
      cidr = cidr
      az   = var.availability_zones[idx]
    }
  } : {}

  private_subnet_map = local.create_mode ? {
    for idx, cidr in var.private_subnet_cidrs : idx => {
      cidr = cidr
      az   = var.availability_zones[idx]
    }
  } : {}
}

data "aws_vpc" "existing" {
  count = var.use_existing_vpc ? 1 : 0
  id    = var.existing_vpc_id
}

resource "aws_vpc" "this" {
  count      = local.create_mode ? 1 : 0
  cidr_block = var.vpc_cidr
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "this" {
  count  = local.create_mode ? 1 : 0
  vpc_id = aws_vpc.this[0].id
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  for_each          = local.public_subnet_map
  vpc_id            = aws_vpc.this[0].id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${each.key}"
  })
}

resource "aws_subnet" "private" {
  for_each          = local.private_subnet_map
  vpc_id            = aws_vpc.this[0].id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${each.key}"
  })
}

resource "aws_route_table" "public" {
  count  = local.create_mode ? 1 : 0
  vpc_id = aws_vpc.this[0].id
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-rt"
  })
}

resource "aws_route" "public_internet_access" {
  count                  = local.create_mode ? 1 : 0
  route_table_id         = aws_route_table.public[0].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this[0].id
}

resource "aws_route_table_association" "public" {
  for_each       = local.public_subnet_map
  subnet_id      = aws_subnet.public[each.key].id
  route_table_id = aws_route_table.public[0].id
}

locals {
  public_subnet_ids  = local.create_mode ? [for subnet in aws_subnet.public : subnet.id] : []
  private_subnet_ids = local.create_mode ? [for subnet in aws_subnet.private : subnet.id] : []

  nat_gateway_enabled = local.create_mode && var.enable_nat_gateway == true
  nat_gateway_count   = local.nat_gateway_enabled ? (var.single_nat_gateway == true ? 1 : length(local.public_subnet_ids)) : 0
  nat_gateway_subnet_map = local.nat_gateway_enabled ? (
    var.single_nat_gateway == true ? { 0 = local.public_subnet_ids[0] } :
    { for idx, subnet_id in local.public_subnet_ids : idx => subnet_id }
  ) : {}
}

resource "aws_eip" "nat" {
  for_each = local.nat_gateway_subnet_map
  domain   = "vpc"
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-eip-${each.key}"
  })
}

resource "aws_nat_gateway" "this" {
  for_each      = local.nat_gateway_subnet_map
  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = each.value
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-${each.key}"
  })
  depends_on = [aws_internet_gateway.this]
}

locals {
  nat_gateway_ids = { for idx, nat in aws_nat_gateway.this : idx => nat.id }
  nat_gateway_id_by_index = local.nat_gateway_enabled ? (
    var.single_nat_gateway == true
      ? { for idx, _ in local.private_subnet_map : idx => local.nat_gateway_ids[0] }
      : local.nat_gateway_ids
  ) : {}
}

resource "aws_route_table" "private" {
  for_each = local.private_subnet_map
  vpc_id   = aws_vpc.this[0].id
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-rt-${each.key}"
  })
}

resource "aws_route" "private_nat" {
  for_each               = local.nat_gateway_enabled ? local.private_subnet_map : {}
  route_table_id         = aws_route_table.private[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = local.nat_gateway_id_by_index[each.key]
}

resource "aws_route_table_association" "private" {
  for_each       = local.private_subnet_map
  subnet_id      = aws_subnet.private[each.key].id
  route_table_id = aws_route_table.private[each.key].id
}
