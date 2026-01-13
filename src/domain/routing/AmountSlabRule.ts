import {RoutingRule} from "./RoutingRule";
import {RoutingRuleStatus} from "./RoutingRuleStatus";
import {RoutingContext} from "./RoutingContext";
import {GatewayDistribution} from "./GatewayDistribution";
import {AmountRange} from "./AmountRange";
import {PaymentFlow} from "../payment_intent/PaymentIntent";

/**
 * Amount slab rule applies different percentage distributions based on amount ranges.
 * 
 * Invariants:
 * - Slabs must not overlap
 * - Each slab's distributions must sum to 100
 * - Slabs should cover the full amount range (gaps are allowed but discouraged)
 */
export class AmountSlabRule extends RoutingRule {
    constructor(
        ruleId: string,
        priority: number,
        status: RoutingRuleStatus,
        version: number,
        createdAt: Date,
        updatedAt: Date,
        public readonly slabs: Array<{
            range: AmountRange;
            distributions: GatewayDistribution[];
        }>,
        paymentFlowTypes?: PaymentFlow[],
        paymentMethodTypeIds?: string[],
        description?: string
    ) {
        super(
            ruleId,
            "AMOUNT_SLAB",
            priority,
            status,
            version,
            createdAt,
            updatedAt,
            paymentFlowTypes,
            paymentMethodTypeIds,
            description
        );

        // Invariant: Each slab's distributions must sum to 100
        for (const slab of slabs) {
            const total = slab.distributions.reduce((sum, dist) => sum + dist.percentage, 0);
            if (Math.abs(total - 100) > 0.01) {
                throw new Error(`Slab distributions must sum to 100, got ${total}`);
            }
        }

        // Invariant: At least one slab must be specified
        if (slabs.length === 0) {
            throw new Error("At least one amount slab must be specified");
        }
    }

    protected matchesRuleSpecific(context: RoutingContext, eligibleGateways: string[]): boolean {
        // Find matching slab
        const matchingSlab = this.slabs.find(slab => slab.range.contains(context.amount));
        if (!matchingSlab) {
            return false;
        }

        // All gateway IDs in the slab's distributions must be eligible
        const distributionGateways = matchingSlab.distributions.map(d => d.gatewayId);
        const allEligible = distributionGateways.every(gw => eligibleGateways.includes(gw));
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
        // Find matching slab
        const matchingSlab = this.slabs.find(slab => slab.range.contains(context.amount));
        if (!matchingSlab) {
            return null;
        }

        // Filter out unavailable gateways
        const healthyDistributions = matchingSlab.distributions.filter(dist => {
            const health = gatewayHealth.get(dist.gatewayId);
            return health !== "UNAVAILABLE";
        });

        if (healthyDistributions.length === 0) {
            return null;
        }

        // Deterministic selection based on context hash (same as PercentageDistributionRule)
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
            const matchingSlab = this.slabs.find(slab => slab.range.contains(context.amount));
            const range = matchingSlab?.range;
            const dist = matchingSlab?.distributions.find(d => d.gatewayId === selectedGateway);
            return `AmountSlabRule[${this.ruleId}] selected gateway ${selectedGateway} for amount ${context.amount} in range [${range?.minAmount}, ${range?.maxAmount}]`;
        }
        return `AmountSlabRule[${this.ruleId}] could not select gateway for amount ${context.amount}`;
    }

    withVersion(version: number, updatedAt: Date): RoutingRule {
        return new AmountSlabRule(
            this.ruleId,
            this.priority,
            this.status,
            version,
            this.createdAt,
            updatedAt,
            this.slabs,
            this.paymentFlowTypes,
            this.paymentMethodTypeIds,
            this.description
        );
    }
}

