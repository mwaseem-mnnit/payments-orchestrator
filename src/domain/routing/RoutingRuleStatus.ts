/**
 * Status of a routing rule.
 * 
 * Invariants:
 * - Only ACTIVE rules are evaluated during routing
 * - INACTIVE rules are retained for audit history
 */
export type RoutingRuleStatus = "ACTIVE" | "INACTIVE";

