import {RoutingRule} from "./RoutingRule";
import {RoutingRuleStatus} from "./RoutingRuleStatus";
import {RoutingContext} from "./RoutingContext";
import {GatewayDistribution} from "./GatewayDistribution";
import {PaymentFlow} from "../payment_intent/PaymentIntent";

/**
 * External distribution rule uses gateway distribution fetched from an external system.
 * Distribution is cached, versioned, and must be deterministic.
 * 
 * Invariants:
 * - External configuration source must be specified
 * - Distribution must be cached and versioned
 * - Selection logic is same as PercentageDistributionRule (deterministic hash-based)
 */
export class ExternalDistributionRule extends RoutingRule {
    constructor(
        ruleId: string,
        priority: number,
        status: RoutingRuleStatus,
        version: number,
        createdAt: Date,
        updatedAt: Date,
        public readonly externalSourceId: string,
        public readonly externalConfigurationVersion: string,
        public readonly cachedDistributions: GatewayDistribution[],
        public readonly cachedAt: Date,
        paymentFlowTypes?: PaymentFlow[],
        paymentMethodTypeIds?: string[],
        description?: string
    ) {
        super(
            ruleId,
            "EXTERNAL_DISTRIBUTION",
            priority,
            status,
            version,
            createdAt,
            updatedAt,
            paymentFlowTypes,
            paymentMethodTypeIds,
            description
        );

        // Invariant: Cached distributions must sum to 100
        const total = cachedDistributions.reduce((sum, dist) => sum + dist.percentage, 0);
        if (Math.abs(total - 100) > 0.01) {
            throw new Error(`Cached distribution percentages must sum to 100, got ${total}`);
        }

        // Invariant: At least one gateway must be cached
        if (cachedDistributions.length === 0) {
            throw new Error("At least one cached gateway distribution must be specified");
        }
    }

    protected matchesRuleSpecific(context: RoutingContext, eligibleGateways: string[]): boolean {
        // All cached gateway IDs must be eligible
        const cachedGateways = this.cachedDistributions.map(d => d.gatewayId);
        const allEligible = cachedGateways.every(gw => eligibleGateways.includes(gw));
        if (!allEligible) {
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
        const healthyDistributions = this.cachedDistributions.filter(dist => {
            const health = gatewayHealth.get(dist.gatewayId);
            return health !== "UNAVAILABLE";
        });

        if (healthyDistributions.length === 0) {
            return null;
        }

        // Deterministic selection based on context hash
        const hashValue = this.computeHash(context);
        const bucket = hashValue % 100;

        let cumulativePercentage = 0;
        for (const dist of healthyDistributions) {
            cumulativePercentage += dist.percentage;
            if (bucket < cumulativePercentage) {
                return dist.gatewayId;
            }
        }

        return healthyDistributions[healthyDistributions.length - 1].gatewayId;
    }

    private computeHash(context: RoutingContext): number {
        const seed = context.payerReference || context.payeeReference || 
                     `${context.amount}-${context.currency}`;
        
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    getExplanation(context: RoutingContext, selectedGateway: string | null): string {
        if (selectedGateway) {
            const dist = this.cachedDistributions.find(d => d.gatewayId === selectedGateway);
            return `ExternalDistributionRule[${this.ruleId}] selected gateway ${selectedGateway} from external source ${this.externalSourceId} (config version: ${this.externalConfigurationVersion})`;
        }
        return `ExternalDistributionRule[${this.ruleId}] could not select gateway (all unavailable)`;
    }

    withVersion(version: number, updatedAt: Date): RoutingRule {
        return new ExternalDistributionRule(
            this.ruleId,
            this.priority,
            this.status,
            version,
            this.createdAt,
            updatedAt,
            this.externalSourceId,
            this.externalConfigurationVersion,
            this.cachedDistributions,
            this.cachedAt,
            this.paymentFlowTypes,
            this.paymentMethodTypeIds,
            this.description
        );
    }
}

