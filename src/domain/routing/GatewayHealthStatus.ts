/**
 * Gateway health status values.
 * Health is evaluated externally but used as input to routing decisions.
 * 
 * Invariants:
 * - Only HEALTHY or DEGRADED gateways may be selected
 * - UNAVAILABLE gateways must not be considered
 * - Health evaluation must never block routing
 */
export type GatewayHealthStatus = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";

