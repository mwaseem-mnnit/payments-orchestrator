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

variable "cluster_oidc_provider_arn" {
  type = string
  validation {
    condition     = (trimspace(var.cluster_oidc_provider_arn) != "")
    error_message = "cluster_oidc_provider_arn must be provided and non-empty."
  }
}

variable "cluster_oidc_provider_url" {
  type = string
  validation {
    condition     = (trimspace(var.cluster_oidc_provider_url) != "")
    error_message = "cluster_oidc_provider_url must be provided and non-empty."
  }
}

variable "namespace" {
  type = string
  validation {
    condition     = (trimspace(var.namespace) != "")
    error_message = "namespace must be provided and non-empty."
  }
}

variable "service_account_name" {
  type = string
  validation {
    condition     = (trimspace(var.service_account_name) != "")
    error_message = "service_account_name must be provided and non-empty."
  }
}

variable "policy_statements" {
  type = list(object({
    effect    = string
    actions   = list(string)
    resources = list(string)
  }))
  validation {
    condition     = (length(var.policy_statements) > 0)
    error_message = "policy_statements must include at least one statement."
  }
}
