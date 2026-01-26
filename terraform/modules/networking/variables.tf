variable "use_existing_vpc" {
  type = bool
}

variable "existing_vpc_id" {
  type     = string
  nullable = true
  default  = null

  validation {
    condition = (
      var.use_existing_vpc
      ? var.existing_vpc_id != null && trimspace(var.existing_vpc_id) != ""
      : var.existing_vpc_id == null
    )
    error_message = "existing_vpc_id must be set when use_existing_vpc = true and unset otherwise."
  }
}

variable "existing_private_subnet_ids" {
  type     = list(string)
  nullable = true
  default  = null

  validation {
    condition = (
      var.use_existing_vpc
      ? var.existing_private_subnet_ids != null && length(var.existing_private_subnet_ids) > 0
      : var.existing_private_subnet_ids == null
    )
    error_message = "existing_private_subnet_ids must be set when use_existing_vpc = true and unset otherwise."
  }
}

variable "existing_public_subnet_ids" {
  type     = list(string)
  nullable = true
  default  = null

  validation {
    condition = (
      var.use_existing_vpc
      ? true
      : var.existing_public_subnet_ids == null
    )
    error_message = "existing_public_subnet_ids must only be set when use_existing_vpc = true."
  }
}

variable "availability_zones" {
  type = list(string)

  validation {
    condition     = length(var.availability_zones) > 0
    error_message = "availability_zones must be provided and non-empty."
  }
}

variable "vpc_cidr" {
  type     = string
  nullable = true
  default  = null

  validation {
    condition = (
      var.use_existing_vpc
      ? var.vpc_cidr == null
      : var.vpc_cidr != null && trimspace(var.vpc_cidr) != ""
    )
    error_message = "vpc_cidr must be set only when creating a new VPC."
  }
}

variable "public_subnet_cidrs" {
  type     = list(string)
  nullable = true
  default  = null

  validation {
    condition = (
      var.use_existing_vpc
      ? var.public_subnet_cidrs == null
      : var.public_subnet_cidrs != null && length(var.public_subnet_cidrs) > 0
    )
    error_message = "public_subnet_cidrs must be set only when creating a new VPC."
  }

  validation {
    condition = (
      var.use_existing_vpc
      ? true
      : length(var.public_subnet_cidrs) == length(var.availability_zones)
    )
    error_message = "public_subnet_cidrs must match availability_zones count."
  }
}

variable "private_subnet_cidrs" {
  type     = list(string)
  nullable = true
  default  = null

  validation {
    condition = (
      var.use_existing_vpc
      ? var.private_subnet_cidrs == null
      : var.private_subnet_cidrs != null && length(var.private_subnet_cidrs) > 0
    )
    error_message = "private_subnet_cidrs must be set only when creating a new VPC."
  }

  validation {
    condition = (
      var.use_existing_vpc
      ? true
      : length(var.private_subnet_cidrs) == length(var.availability_zones)
    )
    error_message = "private_subnet_cidrs must match availability_zones count."
  }
}

variable "enable_nat_gateway" {
  type     = bool
  nullable = true
  default  = null

  validation {
    condition = (
      var.use_existing_vpc
      ? var.enable_nat_gateway == null
      : var.enable_nat_gateway != null
    )
    error_message = "enable_nat_gateway must be set only when creating a new VPC."
  }
}

variable "single_nat_gateway" {
  type     = bool
  nullable = true
  default  = null

  validation {
    condition = (
      var.use_existing_vpc
      ? var.single_nat_gateway == null
      : true
    )
    error_message = "single_nat_gateway must be set only when creating a new VPC."
  }

  validation {
    condition = (
      var.use_existing_vpc
      ? true
      : var.single_nat_gateway == null || var.enable_nat_gateway == true
    )
    error_message = "single_nat_gateway can be set only when enable_nat_gateway is true."
  }
}

variable "name_prefix" {
  type = string
}

variable "tags" {
  type = map(string)
}
