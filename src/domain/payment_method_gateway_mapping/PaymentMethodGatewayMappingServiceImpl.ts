import {
    PaymentMethodGatewayMappingService,
    PaymentMethodGatewayMappingContext,
    EligibleGateway
} from "./PaymentMethodGatewayMappingService";
import { MappingRule } from "./MappingRule";
import { MappingRuleRepository } from "./MappingRuleRepository";

/**
 * Implementation of PaymentMethodGatewayMappingService.
 * 
 * This service evaluates mapping rules to determine gateway eligibility.
 * 
 * Invariants:
 * - Rules are evaluated by priority (ascending order)
 * - First matching ACTIVE rule per (methodTypeId, gatewayId) applies
 * - All rule conditions must match (AND logic)
 * - Absence of matching rule = NOT ELIGIBLE
 * - Returns a set (no duplicates, no ordering)
 * 
 * This service is a HARD ELIGIBILITY GATE.
 * It does NOT:
 * - Select a gateway
 * - Rank gateways
 * - Apply percentages
 * - Consider gateway health
 * - Perform routing
 */
export class PaymentMethodGatewayMappingServiceImpl
    implements PaymentMethodGatewayMappingService
{
    constructor(
        private readonly mappingRuleRepository: MappingRuleRepository
    ) {
        if (!mappingRuleRepository) {
            throw new Error("MappingRuleRepository must be provided");
        }
    }

    /**
     * Resolves eligible gateways for the given payment context.
     * 
     * Algorithm:
     * 1. Load all active mapping rules
     * 2. Filter rules that match the context (methodTypeId + conditions)
     * 3. Group by (methodTypeId, gatewayId)
     * 4. For each group, select the rule with highest priority (lowest priority number)
     * 5. Return set of eligible gateways with audit metadata
     * 
     * Determinism:
     * - Same context + same rule configuration = same output
     * - No randomness
     * - No time-based logic beyond effectiveFrom/effectiveTo
     */
    async resolveEligibleGateways(
        context: PaymentMethodGatewayMappingContext
    ): Promise<Set<EligibleGateway>> {
        // Validate context
        this.validateContext(context);

        // Load all active rules
        const allRules = await this.mappingRuleRepository.getAllActiveRules();

        // Filter rules that match the context
        const matchingRules = this.filterMatchingRules(allRules, context);

        if (matchingRules.length === 0) {
            // No matching rules = no eligible gateways
            return new Set<EligibleGateway>();
        }

        // Group rules by (methodTypeId, gatewayId) and select highest priority rule per group
        return this.selectHighestPriorityRules(matchingRules);
    }

    /**
     * Validates the mapping context.
     * 
     * Invariants:
     * - paymentFlow must be specified
     * - methodTypeId must be specified
     * - region must be specified (mandatory dimension)
     */
    private validateContext(context: PaymentMethodGatewayMappingContext): void {
        if (!context.paymentFlow) {
            throw new Error("paymentFlow is required");
        }

        if (!context.methodTypeId || context.methodTypeId.trim().length === 0) {
            throw new Error("methodTypeId is required");
        }

        if (!context.region || context.region.trim().length === 0) {
            throw new Error("region is required for mapping evaluation");
        }
    }

    /**
     * Filters rules that match the given context.
     * 
     * A rule matches if:
     * - methodTypeId matches
     * - All conditions match (AND logic)
     * - Rule is active and effective
     */
    private filterMatchingRules(
        rules: MappingRule[],
        context: PaymentMethodGatewayMappingContext
    ): MappingRule[] {
        return rules.filter((rule) => rule.matches(context));
    }

    /**
     * Selects the highest priority rule (lowest priority number) for each unique
     * (methodTypeId, gatewayId) combination.
     * 
     * Invariants:
     * - First matching rule per gateway wins
     * - Returns set (no duplicates)
     * - Includes audit metadata (ruleId, ruleVersion)
     */
    private selectHighestPriorityRules(
        rules: MappingRule[]
    ): Set<EligibleGateway> {
        // Group by gatewayId (since all rules already match methodTypeId from filterMatchingRules)
        const gatewayRuleMap = new Map<string, MappingRule>();

        for (const rule of rules) {
            const existingRule = gatewayRuleMap.get(rule.gatewayId);

            // If no existing rule for this gateway, or this rule has higher priority (lower number)
            if (!existingRule || rule.priority < existingRule.priority) {
                gatewayRuleMap.set(rule.gatewayId, rule);
            }
        }

        // Convert to set of EligibleGateway
        const eligibleGateways = new Set<EligibleGateway>();

        for (const rule of gatewayRuleMap.values()) {
            eligibleGateways.add({
                gatewayId: rule.gatewayId,
                appliedRuleId: rule.ruleId,
                ruleVersion: rule.version,
            });
        }

        return eligibleGateways;
    }
}


