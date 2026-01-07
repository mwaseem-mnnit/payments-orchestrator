import { RoutingRule } from "./RoutingRule";
import { RoutingRuleType } from "./RoutingRuleType";
import { RoutingRuleStatus } from "./RoutingRuleStatus";
import { RoutingContext } from "./RoutingContext";
import { GatewayDistribution } from "./GatewayDistribution";

/**
 * Percentage distribution rule splits traffic across multiple gateways.
 * 
 * Invariants:
 * - Percentages must sum to 100
 * - Selection must be deterministic (based on context hash, not random)
 * - At least one gateway must be specified
 */
export class PercentageDistributionRule extends RoutingRule {
    constructor(
        ruleId: string,
        priority: number,
        status: RoutingRuleStatus,
        version: number,
        createdAt: Date,
        updatedAt: Date,
        public readonly distributions: GatewayDistribution[],
        public readonly paymentMethodTypeId?: string,
        public readonly paymentFlowType?: string,
        description?: string
    ) {
        super(
            ruleId,
            "PERCENTAGE_DISTRIBUTION",
            priority,
            status,
            version,
            createdAt,
            updatedAt,
            description
        );

        // Invariant: Distributions must sum to 100
        const total = distributions.reduce((sum, dist) => sum + dist.percentage, 0);
        if (Math.abs(total - 100) > 0.01) {
            throw new Error(`Distribution percentages must sum to 100, got ${total}`);
        }

        // Invariant: At least one gateway must be specified
        if (distributions.length === 0) {
            throw new Error("At least one gateway distribution must be specified");
        }
    }

    matches(context: RoutingContext, eligibleGateways: string[]): boolean {
        // All gateway IDs in distributions must be eligible
        const distributionGateways = this.distributions.map(d => d.gatewayId);
        const allEligible = distributionGateways.every(gw => eligibleGateways.includes(gw));
        if (!allEligible) {
            return false;
        }

        // Optional filters
        if (this.paymentMethodTypeId && context.paymentMethodTypeId !== this.paymentMethodTypeId) {
            return false;
        }

        if (this.paymentFlowType && context.paymentFlowType !== this.paymentFlowType) {
            return false;
        }

        return true;
    }

    selectGateway(
        context: RoutingContext,
        eligibleGateways: string[],
        gatewayHealth: Map<string, string>
    ): string | null {
        // Filter out unavailable gateways
        const healthyDistributions = this.distributions.filter(dist => {
            const health = gatewayHealth.get(dist.gatewayId);
            return health !== "UNAVAILABLE";
        });

        if (healthyDistributions.length === 0) {
            return null;
        }

        // Deterministic selection based on context hash
        // Using correlationId or transactionId ensures same context always selects same gateway
        const hashValue = this.computeHash(context);
        const bucket = hashValue % 100;

        let cumulativePercentage = 0;
        for (const dist of healthyDistributions) {
            cumulativePercentage += dist.percentage;
            if (bucket < cumulativePercentage) {
                return dist.gatewayId;
            }
        }

        // Fallback to last gateway if hash falls through
        return healthyDistributions[healthyDistributions.length - 1].gatewayId;
    }

    /**
     * Computes a deterministic hash from routing context.
     * Uses correlationId or transactionId if available, otherwise falls back to amount + currency.
     */
    private computeHash(context: RoutingContext): number {
        // Use payerReference or payeeReference as seed for determinism
        const seed = context.payerReference || context.payeeReference || 
                     `${context.amount}-${context.currency}`;
        
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    getExplanation(context: RoutingContext, selectedGateway: string | null): string {
        if (selectedGateway) {
            const dist = this.distributions.find(d => d.gatewayId === selectedGateway);
            const percentage = dist ? dist.percentage : 0;
            return `PercentageDistributionRule[${this.ruleId}] selected gateway ${selectedGateway} (${percentage}% distribution)`;
        }
        return `PercentageDistributionRule[${this.ruleId}] could not select gateway (all unavailable)`;
    }

    withVersion(version: number, updatedAt: Date): RoutingRule {
        return new PercentageDistributionRule(
            this.ruleId,
            this.priority,
            this.status,
            version,
            this.createdAt,
            updatedAt,
            this.distributions,
            this.paymentMethodTypeId,
            this.paymentFlowType,
            this.description
        );
    }
}

