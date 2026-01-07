/**
 * Types of routing rules supported by the system.
 * Must be extensible for future rule types.
 */
export type RoutingRuleType =
    | "FIXED_GATEWAY"
    | "PERCENTAGE_DISTRIBUTION"
    | "AMOUNT_SLAB"
    | "EXTERNAL_DISTRIBUTION";

