output "payment_orchestrator_irsa_role_arn" {
  description = "IAM role ARN used by Kubernetes ServiceAccount via IRSA"
  value = module.payment_orchestrator_irsa.role_arn
}

output "alb_controller_irsa_role_arn" {
  description = "Cluster-level IRSA role ARN for the load balancer controller"
  value = module.alb_controller_irsa.role_arn
}