resource "aws_iam_role" "this" {
  name = "${var.name_prefix}-irsa-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRoleWithWebIdentity"
        Principal = {
          Federated = var.cluster_oidc_provider_arn
        }
        Condition = {
          StringEquals = {
            "${var.cluster_oidc_provider_url}:sub" = "system:serviceaccount:${var.namespace}:${var.service_account_name}"
            "${var.cluster_oidc_provider_url}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
  tags = var.tags
}

resource "aws_iam_policy" "this" {
  count = length(var.policy_statements) > 0 ? 1 : 0

  name = "${var.name_prefix}-irsa-policy"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      for stmt in var.policy_statements : {
        Effect   = stmt.effect
        Action   = stmt.actions
        Resource = stmt.resources
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "this" {
  count = length(var.policy_statements) > 0 ? 1 : 0
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.this[0].arn
}

