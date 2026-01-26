locals {
  payment_intent_table_name            = (var.use_existing_tables ? var.existing_table_names.payment_intent : "${var.name_prefix}-payment-intent")
  payment_method_table_name            = (var.use_existing_tables ? var.existing_table_names.payment_method : "${var.name_prefix}-payment-method")
  payment_method_identifier_table_name = (var.use_existing_tables ? var.existing_table_names.payment_method_identifier : "${var.name_prefix}-payment-method-identifier")
  gateway_ref_table_name               = (var.use_existing_tables ? var.existing_table_names.gateway_ref : "${var.name_prefix}-gateway-ref")
  payment_fact_table_name              = (var.use_existing_tables ? var.existing_table_names.payment_fact : "${var.name_prefix}-payment-fact")
  idempotency_table_name               = (var.use_existing_tables ? var.existing_table_names.idempotency : "${var.name_prefix}-idempotency")
}

data "aws_dynamodb_table" "payment_intent" {
  count = (var.use_existing_tables ? 1 : 0)
  name  = local.payment_intent_table_name
}

data "aws_dynamodb_table" "payment_method" {
  count = (var.use_existing_tables ? 1 : 0)
  name  = local.payment_method_table_name
}

data "aws_dynamodb_table" "payment_method_identifier" {
  count = (var.use_existing_tables ? 1 : 0)
  name  = local.payment_method_identifier_table_name
}

data "aws_dynamodb_table" "gateway_ref" {
  count = (var.use_existing_tables ? 1 : 0)
  name  = local.gateway_ref_table_name
}

data "aws_dynamodb_table" "payment_fact" {
  count = (var.use_existing_tables ? 1 : 0)
  name  = local.payment_fact_table_name
}

data "aws_dynamodb_table" "idempotency" {
  count = (var.use_existing_tables ? 1 : 0)
  name  = local.idempotency_table_name
}

resource "aws_dynamodb_table" "payment_intent" {
  count        = (var.use_existing_tables ? 0 : 1)
  name         = local.payment_intent_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "payment_intent_id"

  attribute {
    name = "payment_intent_id"
    type = "S"
  }

  attribute {
    name = "transaction_id_gsi"
    type = "S"
  }

  attribute {
    name = "payment_method_id_gsi"
    type = "S"
  }

  attribute {
    name = "gateway_transaction_reference_gsi"
    type = "S"
  }

  attribute {
    name = "user_identifier_gsi"
    type = "S"
  }

  attribute {
    name = "created_at_gsi"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI_transaction_id"
    hash_key        = "transaction_id_gsi"
    range_key       = "created_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  global_secondary_index {
    name            = "GSI_payment_method"
    hash_key        = "payment_method_id_gsi"
    range_key       = "created_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  global_secondary_index {
    name            = "GSI_gateway_transaction"
    hash_key        = "gateway_transaction_reference_gsi"
    range_key       = "created_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  global_secondary_index {
    name            = "GSI_user_identifier"
    hash_key        = "user_identifier_gsi"
    range_key       = "created_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "payment_method" {
  count        = (var.use_existing_tables ? 0 : 1)
  name         = local.payment_method_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "payment_method_id"

  attribute {
    name = "payment_method_id"
    type = "S"
  }

  attribute {
    name = "user_id_gsi"
    type = "S"
  }

  attribute {
    name = "last_used_at_gsi"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI_user_usage"
    hash_key        = "user_id_gsi"
    range_key       = "last_used_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "payment_method_identifier" {
  count        = (var.use_existing_tables ? 0 : 1)
  name         = local.payment_method_identifier_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "identifier_type_normalized_value"
  range_key    = "created_at"

  attribute {
    name = "identifier_type_normalized_value"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "N"
  }

  attribute {
    name = "payment_method_id_gsi"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI_payment_method"
    hash_key        = "payment_method_id_gsi"
    projection_type = "KEYS_ONLY"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "gateway_ref" {
  count        = (var.use_existing_tables ? 0 : 1)
  name         = local.gateway_ref_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "gateway_ref_id"

  attribute {
    name = "gateway_ref_id"
    type = "S"
  }

  attribute {
    name = "payment_method_id_gsi"
    type = "S"
  }

  attribute {
    name = "normalized_key_gsi"
    type = "S"
  }

  attribute {
    name = "created_at_gsi"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI_payment_method"
    hash_key        = "payment_method_id_gsi"
    range_key       = "created_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  global_secondary_index {
    name            = "GSI_normalized_key"
    hash_key        = "normalized_key_gsi"
    range_key       = "created_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "payment_fact" {
  count        = (var.use_existing_tables ? 0 : 1)
  name         = local.payment_fact_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "fact_id"

  attribute {
    name = "fact_id"
    type = "S"
  }

  attribute {
    name = "transaction_id_gsi"
    type = "S"
  }

  attribute {
    name = "gateway_transaction_reference_gsi"
    type = "S"
  }

  attribute {
    name = "idempotency_key_gsi"
    type = "S"
  }

  attribute {
    name = "received_at_gsi"
    type = "N"
  }

  global_secondary_index {
    name            = "GSI_transaction"
    hash_key        = "transaction_id_gsi"
    range_key       = "received_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  global_secondary_index {
    name            = "GSI_gateway_transaction"
    hash_key        = "gateway_transaction_reference_gsi"
    range_key       = "received_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  global_secondary_index {
    name            = "GSI_idempotency"
    hash_key        = "idempotency_key_gsi"
    range_key       = "received_at_gsi"
    projection_type = "KEYS_ONLY"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "idempotency" {
  count        = (var.use_existing_tables ? 0 : 1)
  name         = local.idempotency_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "idempotency_key"

  attribute {
    name = "idempotency_key"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = var.tags
}
