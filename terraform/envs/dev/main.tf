module "networking" {
  source = "../../modules/networking"

  use_existing_vpc             = true
  existing_vpc_id              = var.existing_vpc_id
  existing_private_subnet_ids  = var.existing_private_subnet_ids
  existing_public_subnet_ids   = var.existing_public_subnet_ids
  availability_zones           = var.availability_zones
  name_prefix                  = var.name_prefix
  tags                         = var.tags
}

module "eks" {
  source = "../../modules/eks"

  cluster_name           = var.cluster_name
  kubernetes_version     = var.kubernetes_version
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  availability_zones     = module.networking.availability_zones
  endpoint_public_access  = var.endpoint_public_access
  endpoint_private_access = var.endpoint_private_access
  node_groups            = var.node_groups
  enable_irsa               = true
  enabled_cluster_log_types = []
  name_prefix            = var.name_prefix
  tags                   = var.tags
}

module "dynamodb" {
  source = "../../modules/dynamodb"

  name_prefix         = var.name_prefix
  tags                = var.tags
  use_existing_tables = (var.create_mode ? false : true)
  enable_pitr         = var.enable_pitr
}

locals {
  table_arns = [
    module.dynamodb.payment_intent_table_arn,
    module.dynamodb.payment_method_table_arn,
    module.dynamodb.payment_method_identifier_table_arn,
    module.dynamodb.gateway_ref_table_arn,
    module.dynamodb.payment_fact_table_arn,
    module.dynamodb.idempotency_table_arn
  ]
  index_arns = [for arn in local.table_arns : "${arn}/index/*"]
  policy_resources = concat(local.table_arns, local.index_arns)
  cluster_oidc_provider_url = element(
    split("oidc-provider/", module.eks.oidc_provider_arn),
    1
  )
}

module "payment_orchestrator_irsa" {
  source = "../../modules/irsa"

  name_prefix = var.name_prefix
  tags        = var.tags

  cluster_oidc_provider_arn = module.eks.oidc_provider_arn
  cluster_oidc_provider_url = local.cluster_oidc_provider_url

  namespace            = "default"
  service_account_name = "payment-orchestrator"

  policy_statements = [
    {
      effect = "Allow"
      actions = [
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem",
        "dynamodb:Query",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:BatchWriteItem"
      ]
      resources = local.policy_resources
    }
  ]
}

module "alb_controller_irsa" {
  source = "../../modules/irsa"

  name_prefix = "${var.name_prefix}-alb-controller-v2"
  tags        = var.tags

  cluster_oidc_provider_arn = module.eks.oidc_provider_arn
  cluster_oidc_provider_url = local.cluster_oidc_provider_url

  namespace            = "kube-system"
  service_account_name = "aws-load-balancer-controller"

  policy_statements = [
    {
      effect = "Allow"
      actions = [
        "iam:CreateServiceLinkedRole",
        "ec2:DescribeAccountAttributes",
        "ec2:DescribeAddresses",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeInternetGateways",
        "ec2:DescribeVpcs",
        "ec2:DescribeVpcPeeringConnections",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeInstances",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeTags",
        "ec2:GetCoipPoolUsage",
        "ec2:DescribeCoipPools",
        "ec2:DescribeRouteTables",
        "ec2:GetSecurityGroupsForVpc",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeLoadBalancerAttributes",
        "elasticloadbalancing:DescribeListeners",
        "elasticloadbalancing:DescribeListenerCertificates",
        "elasticloadbalancing:DescribeSSLPolicies",
        "elasticloadbalancing:DescribeRules",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetGroupAttributes",
        "elasticloadbalancing:DescribeTargetHealth",
        "elasticloadbalancing:DescribeTags"
      ]
      resources = ["*"]
    },
    {
      effect = "Allow"
      actions = [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:CreateSecurityGroup",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:DeleteSecurityGroup",
        "elasticloadbalancing:AddTags",
        "elasticloadbalancing:RemoveTags",
        "elasticloadbalancing:CreateLoadBalancer",
        "elasticloadbalancing:CreateTargetGroup",
        "elasticloadbalancing:CreateListener",
        "elasticloadbalancing:DeleteListener",
        "elasticloadbalancing:CreateRule",
        "elasticloadbalancing:DeleteRule",
        "elasticloadbalancing:ModifyLoadBalancerAttributes",
        "elasticloadbalancing:SetIpAddressType",
        "elasticloadbalancing:SetSecurityGroups",
        "elasticloadbalancing:SetSubnets",
        "elasticloadbalancing:DeleteLoadBalancer",
        "elasticloadbalancing:ModifyTargetGroup",
        "elasticloadbalancing:ModifyTargetGroupAttributes",
        "elasticloadbalancing:DeleteTargetGroup",
        "elasticloadbalancing:RegisterTargets",
        "elasticloadbalancing:DeregisterTargets",
        "elasticloadbalancing:SetWebAcl",
        "elasticloadbalancing:ModifyListener",
        "elasticloadbalancing:AddListenerCertificates",
        "elasticloadbalancing:RemoveListenerCertificates",
        "elasticloadbalancing:ModifyRule"
      ]
      resources = ["*"]
    }
  ]
}