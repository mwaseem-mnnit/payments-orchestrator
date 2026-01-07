import { RoutingRule } from "./RoutingRule";
import { RoutingRuleType } from "./RoutingRuleType";
import { RoutingRuleStatus } from "./RoutingRuleStatus";
import { RoutingContext } from "./RoutingContext";

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
        public readonly paymentMethodTypeId?: string,
        public readonly paymentFlowType?: string,
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
            description
        );
    }

    matches(context: RoutingContext, eligibleGateways: string[]): boolean {
        // Must match gateway eligibility
        if (!eligibleGateways.includes(this.gatewayId)) {
            return false;
        }

        // Optional filters
        if (this.paymentMethodId && context.paymentMethodId !== this.paymentMethodId) {
            return false;
        }

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
            this.paymentMethodTypeId,
            this.paymentFlowType,
            this.description
        );
    }
}

