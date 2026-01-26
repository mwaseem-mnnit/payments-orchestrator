variable "aws_region" {
  type = string
  validation {
    condition     = (trimspace(var.aws_region) != "")
    error_message = "aws_region must be provided and non-empty."
  }
}

variable "name_prefix" {
  type = string
  validation {
    condition     = (trimspace(var.name_prefix) != "")
    error_message = "name_prefix must be provided and non-empty."
  }
}

variable "tags" {
  type = map(string)
  validation {
    condition     = (var.tags != null)
    error_message = "tags must be provided."
  }
}

variable "create_mode" {
  type = bool
  validation {
    condition     = (var.create_mode == true || var.create_mode == false)
    error_message = "create_mode must be explicitly set to true or false."
  }
}

variable "enable_pitr" {
  type = bool
  validation {
    condition     = (var.enable_pitr == true || var.enable_pitr == false)
    error_message = "enable_pitr must be explicitly set to true or false."
  }
}

variable "existing_vpc_id" {
  type = string
  validation {
    condition     = (trimspace(var.existing_vpc_id) != "")
    error_message = "existing_vpc_id must be provided and non-empty."
  }
}

variable "existing_private_subnet_ids" {
  type = list(string)
  validation {
    condition     = (length(var.existing_private_subnet_ids) > 0)
    error_message = "existing_private_subnet_ids must be provided and non-empty."
  }
}

variable "existing_public_subnet_ids" {
  type = list(string)
  validation {
    condition     = (length(var.existing_public_subnet_ids) > 0)
    error_message = "existing_public_subnet_ids must be provided and non-empty."
  }
}

variable "availability_zones" {
  type = list(string)
  validation {
    condition     = (length(var.availability_zones) > 0)
    error_message = "availability_zones must be provided and non-empty."
  }
}

variable "cluster_name" {
  type = string
  validation {
    condition     = (trimspace(var.cluster_name) != "")
    error_message = "cluster_name must be provided and non-empty."
  }
}

variable "kubernetes_version" {
  type = string
  validation {
    condition     = (trimspace(var.kubernetes_version) != "")
    error_message = "kubernetes_version must be provided and non-empty."
  }
}

variable "node_groups" {
  type = map(object({
    instance_types = list(string)
    desired_size   = number
    min_size       = number
    max_size       = number
    disk_size      = number
    capacity_type  = string
  }))
  validation {
    condition     = (length(var.node_groups) > 0)
    error_message = "node_groups must include at least one entry."
  }
  validation {
    condition = (
      alltrue([
        for _, ng in var.node_groups :
        length(ng.instance_types) > 0
      ])
    )
    error_message = "Each node group must include at least one instance type."
  }
  validation {
    condition = (
      alltrue([
        for _, ng in var.node_groups :
        ng.min_size >= 0 && ng.desired_size >= ng.min_size && ng.max_size >= ng.desired_size
      ])
    )
    error_message = "Each node group must satisfy min_size <= desired_size <= max_size."
  }
  validation {
    condition = (
      alltrue([
        for _, ng in var.node_groups :
        ng.disk_size > 0
      ])
    )
    error_message = "Each node group must have a positive disk_size."
  }
  validation {
    condition = (
      alltrue([
        for _, ng in var.node_groups :
        ng.capacity_type == "ON_DEMAND" || ng.capacity_type == "SPOT"
      ])
    )
    error_message = "Each node group capacity_type must be ON_DEMAND or SPOT."
  }
}

variable "endpoint_public_access" {
  type = bool

  validation {
    condition = (
    var.endpoint_public_access == true
    || var.endpoint_private_access == true
    )
    error_message = "At least one of endpoint_public_access or endpoint_private_access must be true."
  }
}


variable "endpoint_private_access" {
  type = bool
}
