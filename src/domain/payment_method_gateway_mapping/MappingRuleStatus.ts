/**
 * Status of a mapping rule.
 * 
 * Invariants:
 * - Only ACTIVE rules are evaluated
 * - INACTIVE rules are ignored
 */
export type MappingRuleStatus = "ACTIVE" | "INACTIVE";


