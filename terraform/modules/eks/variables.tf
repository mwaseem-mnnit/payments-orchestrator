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

variable "vpc_id" {
  type = string
  validation {
    condition     = (trimspace(var.vpc_id) != "")
    error_message = "vpc_id must be provided and non-empty."
  }
}

variable "private_subnet_ids" {
  type = list(string)
  validation {
    condition     = (length(var.private_subnet_ids) > 0)
    error_message = "private_subnet_ids must be provided and non-empty."
  }
}

variable "availability_zones" {
  type = list(string)
  validation {
    condition     = (length(var.availability_zones) > 0)
    error_message = "availability_zones must be provided and non-empty."
  }
}

variable "endpoint_public_access" {
  type = bool
  validation {
    condition     = (var.endpoint_public_access == true || var.endpoint_public_access == false)
    error_message = "endpoint_public_access must be provided."
  }
}

variable "endpoint_private_access" {
  type = bool
  validation {
    condition     = (var.endpoint_private_access == true || var.endpoint_private_access == false)
    error_message = "endpoint_private_access must be provided."
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

variable "enable_irsa" {
  type = bool
  validation {
    condition     = (var.enable_irsa == true || var.enable_irsa == false)
    error_message = "enable_irsa must be provided."
  }
}

variable "enabled_cluster_log_types" {
  type    = list(string)
  default = []
  validation {
    condition     = (var.enabled_cluster_log_types != null)
    error_message = "enabled_cluster_log_types must be provided when set."
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
