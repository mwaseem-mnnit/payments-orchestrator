output "payment_intent_table_name" {
  value = (var.use_existing_tables ? local.payment_intent_table_name : aws_dynamodb_table.payment_intent[0].name)
}

output "payment_intent_table_arn" {
  value = (var.use_existing_tables ? data.aws_dynamodb_table.payment_intent[0].arn : aws_dynamodb_table.payment_intent[0].arn)
}

output "payment_intent_primary_key" {
  value = {
    hash_key  = "payment_intent_id"
    range_key = null
  }
}

output "payment_intent_gsi_names" {
  value = (var.use_existing_tables ? [for gsi in data.aws_dynamodb_table.payment_intent[0].global_secondary_index : gsi.name] : [for gsi in aws_dynamodb_table.payment_intent[0].global_secondary_index : gsi.name])
}

output "payment_method_table_name" {
  value = (var.use_existing_tables ? local.payment_method_table_name : aws_dynamodb_table.payment_method[0].name)
}

output "payment_method_table_arn" {
  value = (var.use_existing_tables ? data.aws_dynamodb_table.payment_method[0].arn : aws_dynamodb_table.payment_method[0].arn)
}

output "payment_method_primary_key" {
  value = {
    hash_key  = "payment_method_id"
    range_key = null
  }
}

output "payment_method_gsi_names" {
  value = (var.use_existing_tables ? [for gsi in data.aws_dynamodb_table.payment_method[0].global_secondary_index : gsi.name] : [for gsi in aws_dynamodb_table.payment_method[0].global_secondary_index : gsi.name])
}

output "payment_method_identifier_table_name" {
  value = (var.use_existing_tables ? local.payment_method_identifier_table_name : aws_dynamodb_table.payment_method_identifier[0].name)
}

output "payment_method_identifier_table_arn" {
  value = (var.use_existing_tables ? data.aws_dynamodb_table.payment_method_identifier[0].arn : aws_dynamodb_table.payment_method_identifier[0].arn)
}

output "payment_method_identifier_primary_key" {
  value = {
    hash_key  = "identifier_type_normalized_value"
    range_key = "created_at"
  }
}

output "payment_method_identifier_gsi_names" {
  value = (var.use_existing_tables ? [for gsi in data.aws_dynamodb_table.payment_method_identifier[0].global_secondary_index : gsi.name] : [for gsi in aws_dynamodb_table.payment_method_identifier[0].global_secondary_index : gsi.name])
}

output "gateway_ref_table_name" {
  value = (var.use_existing_tables ? local.gateway_ref_table_name : aws_dynamodb_table.gateway_ref[0].name)
}

output "gateway_ref_table_arn" {
  value = (var.use_existing_tables ? data.aws_dynamodb_table.gateway_ref[0].arn : aws_dynamodb_table.gateway_ref[0].arn)
}

output "gateway_ref_primary_key" {
  value = {
    hash_key  = "gateway_ref_id"
    range_key = null
  }
}

output "gateway_ref_gsi_names" {
  value = (var.use_existing_tables ? [for gsi in data.aws_dynamodb_table.gateway_ref[0].global_secondary_index : gsi.name] : [for gsi in aws_dynamodb_table.gateway_ref[0].global_secondary_index : gsi.name])
}

output "payment_fact_table_name" {
  value = (var.use_existing_tables ? local.payment_fact_table_name : aws_dynamodb_table.payment_fact[0].name)
}

output "payment_fact_table_arn" {
  value = (var.use_existing_tables ? data.aws_dynamodb_table.payment_fact[0].arn : aws_dynamodb_table.payment_fact[0].arn)
}

output "payment_fact_primary_key" {
  value = {
    hash_key  = "fact_id"
    range_key = null
  }
}

output "payment_fact_gsi_names" {
  value = (var.use_existing_tables ? [for gsi in data.aws_dynamodb_table.payment_fact[0].global_secondary_index : gsi.name] : [for gsi in aws_dynamodb_table.payment_fact[0].global_secondary_index : gsi.name])
}

output "idempotency_table_name" {
  value = (var.use_existing_tables ? local.idempotency_table_name : aws_dynamodb_table.idempotency[0].name)
}

output "idempotency_table_arn" {
  value = (var.use_existing_tables ? data.aws_dynamodb_table.idempotency[0].arn : aws_dynamodb_table.idempotency[0].arn)
}

output "idempotency_primary_key" {
  value = {
    hash_key  = "idempotency_key"
    range_key = null
  }
}

output "idempotency_gsi_names" {
  value = (var.use_existing_tables ? [for gsi in data.aws_dynamodb_table.idempotency[0].global_secondary_index : gsi.name] : [for gsi in aws_dynamodb_table.idempotency[0].global_secondary_index : gsi.name])
}
