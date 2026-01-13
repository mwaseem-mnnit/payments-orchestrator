import { RoutingRule } from "./RoutingRule";

/**
 * Port for retrieving routing rules.
 * 
 * This port is used by routing services to load rules for evaluation.
 * Rules are assumed to be pre-loaded/cached, not queried per request.
 */
export interface RoutingRuleRepository {
    /**
     * Gets all active routing rules.
     * Rules should be returned in priority order (lower priority number first).
     * 
     * @returns Promise resolving to array of active RoutingRules, sorted by priority
     */
    findAllActive(): Promise<RoutingRule[]>;
}
