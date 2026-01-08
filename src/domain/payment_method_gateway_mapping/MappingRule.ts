import { MappingRuleConditions } from "./MappingRuleConditions";
import { MappingRuleStatus } from "./MappingRuleStatus";
import { PaymentMethodGatewayMappingContext } from "./PaymentMethodGatewayMappingService";

/**
 * Domain entity representing a PaymentMethod ↔ Gateway mapping rule.
 * 
 * Invariants:
 * - Rules are evaluated by priority (lower priority number = higher precedence)
 * - Only ACTIVE rules are evaluated
 * - First matching rule per (methodTypeId, gatewayId) applies
 * - All conditions must match for rule to apply (AND logic)
 * - Absence of a matching rule means NOT ELIGIBLE
 */
export class MappingRule {
    constructor(
        public readonly ruleId: string,
        public readonly methodTypeId: string,
        public readonly gatewayId: string,
        public readonly conditions: MappingRuleConditions,
        public readonly priority: number,
        public readonly status: MappingRuleStatus,
        public readonly version: number,
        public readonly effectiveFrom: Date,
        public readonly effectiveTo?: Date,
        public readonly createdAt: Date = new Date(),
        public readonly updatedAt: Date = new Date(),
        public readonly metadata?: Record<string, unknown>
    ) {
        if (priority < 1) {
            throw new Error("Rule priority must be >= 1");
        }

        if (version < 1) {
            throw new Error("Rule version must be >= 1");
        }

        if (effectiveTo && effectiveFrom > effectiveTo) {
            throw new Error("effectiveFrom must be <= effectiveTo");
        }
    }

    /**
     * Checks if this rule matches the given context.
     * 
     * All conditions are ANDed - all must match for the rule to apply.
     * 
     * Invariants:
     * - paymentFlow must match
     * - region must match
     * - All optional conditions must match if specified
     */
    matches(context: PaymentMethodGatewayMappingContext): boolean {
        // Check if rule is active
        if (this.status !== "ACTIVE") {
            return false;
        }

        // Check if rule applies to this method type
        if (this.methodTypeId !== context.methodTypeId) {
            return false;
        }

        // Check if within effective date range
        const now = new Date();
        if (this.effectiveFrom > now) {
            return false;
        }

        if (this.effectiveTo && this.effectiveTo < now) {
            return false;
        }

        // Check mandatory conditions: paymentFlow and region
        if (this.conditions.paymentFlow !== context.paymentFlow) {
            return false;
        }

        if (this.conditions.region !== context.region) {
            return false;
        }

        // Check optional conditions
        if (!this.conditions.matchesCurrency(context.currency)) {
            return false;
        }

        if (!this.conditions.matchesVariant(context.variant)) {
            return false;
        }

        if (!this.conditions.matchesAmount(context.amount)) {
            return false;
        }

        if (!this.conditions.matchesCustomAttributes(context.customAttributes)) {
            return false;
        }

        return true;
    }

    /**
     * Checks if this rule is currently active and effective.
     */
    isActiveAndEffective(): boolean {
        if (this.status !== "ACTIVE") {
            return false;
        }

        const now = new Date();
        if (this.effectiveFrom > now) {
            return false;
        }

        if (this.effectiveTo && this.effectiveTo < now) {
            return false;
        }

        return true;
    }
}


