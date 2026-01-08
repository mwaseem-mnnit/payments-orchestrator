import { MappingRule } from "./MappingRule";

/**
 * Port for retrieving mapping rules.
 * 
 * This port is used by the mapping service to load rules for evaluation.
 * Rules are assumed to be pre-loaded/cached, not queried per request.
 * 
 * This is a conceptual port - actual implementation would be in adapters layer.
 */
export interface MappingRuleRepository {
    /**
     * Gets all active and effective mapping rules.
     * Rules should be returned in priority order (lower priority number first).
     */
    getAllActiveRules(): Promise<MappingRule[]>;

    /**
     * Gets mapping rules for a specific method type and gateway.
     */
    getRulesByMethodTypeAndGateway(
        methodTypeId: string,
        gatewayId: string
    ): Promise<MappingRule[]>;

    /**
     * Gets mapping rules for a specific method type.
     */
    getRulesByMethodType(methodTypeId: string): Promise<MappingRule[]>;
}


