import {RoutingRule} from "./RoutingRule";
import {RoutingRuleStatus} from "./RoutingRuleStatus";
import {RoutingContext} from "./RoutingContext";
import {PaymentFlow} from "../payment_intent/PaymentIntent";

/**
 * Fixed gateway rule selects a specific gateway for matching contexts.
 * 
 * Invariants:
 * - Must specify exactly one gateway
 * - Gateway must be in eligible gateways list
 * - Selection is deterministic (always returns same gateway)
 */
export class FixedGatewayRule extends RoutingRule {
    constructor(
        ruleId: string,
        priority: number,
        status: RoutingRuleStatus,
        version: number,
        createdAt: Date,
        updatedAt: Date,
        public readonly gatewayId: string,
        public readonly paymentMethodId?: string,
        paymentFlowTypes?: PaymentFlow[],
        paymentMethodTypeIds?: string[],
        description?: string
    ) {
        super(
            ruleId,
            "FIXED_GATEWAY",
            priority,
            status,
            version,
            createdAt,
            updatedAt,
            paymentFlowTypes,
            paymentMethodTypeIds,
            description
        );
    }

    protected matchesRuleSpecific(context: RoutingContext, eligibleGateways: string[]): boolean {
        // Must match gateway eligibility
        if (!eligibleGateways.includes(this.gatewayId)) {
            return false;
        }

        // Optional filter: paymentMethodId (rule-specific, not moved to base class)
        if (this.paymentMethodId && context.paymentMethodId !== this.paymentMethodId) {
            return false;
        }

        return true;
    }

    selectGateway(
        context: RoutingContext,
        eligibleGateways: string[],
        gatewayHealth: Map<string, string>
    ): string | null {
        // Check gateway health - must be HEALTHY or DEGRADED
        const health = gatewayHealth.get(this.gatewayId);
        if (health === "UNAVAILABLE") {
            return null;
        }

        return this.gatewayId;
    }

    getExplanation(context: RoutingContext, selectedGateway: string | null): string {
        if (selectedGateway) {
            return `FixedGatewayRule[${this.ruleId}] selected gateway ${this.gatewayId} via fixed rule`;
        }
        return `FixedGatewayRule[${this.ruleId}] could not select gateway ${this.gatewayId} (unavailable)`;
    }

    withVersion(version: number, updatedAt: Date): RoutingRule {
        return new FixedGatewayRule(
            this.ruleId,
            this.priority,
            this.status,
            version,
            this.createdAt,
            updatedAt,
            this.gatewayId,
            this.paymentMethodId,
            this.paymentFlowTypes,
            this.paymentMethodTypeIds,
            this.description
        );
    }
}

