import { RoutingRuleType } from "./RoutingRuleType";
import { RoutingRuleStatus } from "./RoutingRuleStatus";
import { RoutingContext } from "./RoutingContext";

/**
 * Base class for all routing rules.
 * 
 * Invariants:
 * - Rules are evaluated in priority order (lower priority number = higher precedence)
 * - First matching rule wins
 * - Rules are immutable once created (new versions create new rule instances)
 * - Rules must be deterministic
 */
export abstract class RoutingRule {
    constructor(
        public readonly ruleId: string,
        public readonly ruleType: RoutingRuleType,
        public readonly priority: number,
        public readonly status: RoutingRuleStatus,
        public readonly version: number,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly description?: string
    ) {
        // Invariant: Priority must be positive
        if (priority < 1) {
            throw new Error("Rule priority must be >= 1");
        }
        // Invariant: Version must be positive
        if (version < 1) {
            throw new Error("Rule version must be >= 1");
        }
    }

    /**
     * Determines if this rule matches the given routing context.
     * Subclasses must implement rule-specific matching logic.
     * 
     * @param context The routing context to evaluate
     * @param eligibleGateways List of gateway IDs that passed eligibility filtering
     * @returns true if this rule matches the context
     */
    abstract matches(context: RoutingContext, eligibleGateways: string[]): boolean;

    /**
     * Selects a gateway from eligible gateways based on this rule.
     * Only called if matches() returns true.
     * 
     * Subclasses must implement rule-specific selection logic.
     * 
     * @param context The routing context
     * @param eligibleGateways List of gateway IDs that passed eligibility filtering
     * @param gatewayHealth Map of gateway ID to health status
     * @returns Selected gateway ID, or null if no gateway can be selected
     */
    abstract selectGateway(
        context: RoutingContext,
        eligibleGateways: string[],
        gatewayHealth: Map<string, string>
    ): string | null;

    /**
     * Returns a human-readable explanation of why this rule matched or selected a gateway.
     * Used for auditability and debugging.
     */
    abstract getExplanation(
        context: RoutingContext,
        selectedGateway: string | null
    ): string;

    /**
     * Creates a new version of this rule with updated properties.
     * Immutability: original rule is unchanged.
     */
    abstract withVersion(version: number, updatedAt: Date): RoutingRule;

    /**
     * Creates a copy of this rule with updated status.
     */
    withStatus(status: RoutingRuleStatus, updatedAt: Date): RoutingRule {
        return this.withVersion(this.version, updatedAt) as RoutingRule;
    }

    /**
     * Determines if this rule is active and eligible for evaluation.
     */
    isActive(): boolean {
        return this.status === "ACTIVE";
    }
}

