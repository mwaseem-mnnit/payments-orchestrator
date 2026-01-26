variable "use_existing_tables" {
  type = bool
  validation {
    condition     = (var.use_existing_tables == true || var.use_existing_tables == false)
    error_message = "use_existing_tables must be explicitly set to true or false."
  }
}

variable "existing_table_names" {
  type = object({
    payment_intent            = string
    payment_method            = string
    payment_method_identifier = string
    gateway_ref               = string
    payment_fact              = string
    idempotency               = string
  })
  nullable = true
  default  = null
  validation {
    condition = (
      var.use_existing_tables ? (
        var.existing_table_names != null
        && trimspace(var.existing_table_names.payment_intent) != ""
        && trimspace(var.existing_table_names.payment_method) != ""
        && trimspace(var.existing_table_names.payment_method_identifier) != ""
        && trimspace(var.existing_table_names.gateway_ref) != ""
        && trimspace(var.existing_table_names.payment_fact) != ""
        && trimspace(var.existing_table_names.idempotency) != ""
      ) : (var.existing_table_names == null)
    )
    error_message = "existing_table_names must be provided with all table names when use_existing_tables is true and must be null otherwise."
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
  default = {}
  validation {
    condition     = (var.tags != null)
    error_message = "tags must be provided."
  }
}

variable "enable_pitr" {
  type    = bool
  default = true
  validation {
    condition     = (var.enable_pitr == true || var.enable_pitr == false)
    error_message = "enable_pitr must be explicitly set to true or false."
  }
}
