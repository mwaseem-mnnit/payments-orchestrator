import { PaymentFlow } from "../payment_intent/PaymentIntent";

/**
 * Value object representing dimension-based conditions for a mapping rule.
 * 
 * Invariants:
 * - paymentFlow is mandatory
 * - region is mandatory
 * - Optional dimensions are additive (AND logic)
 * - All conditions must match for rule to apply
 */
export class MappingRuleConditions {
    constructor(
        public readonly paymentFlow: PaymentFlow,
        public readonly region: string,
        public readonly currency?: string,
        public readonly variant?: string,
        public readonly minAmount?: number,
        public readonly maxAmount?: number,
        public readonly customAttributes?: Record<string, unknown>
    ) {
        if (!region || region.trim().length === 0) {
            throw new Error("Region is mandatory for mapping rule conditions");
        }

        if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
            throw new Error("Min amount must be <= max amount");
        }

        if (minAmount !== undefined && minAmount < 0) {
            throw new Error("Min amount must be non-negative");
        }

        if (maxAmount !== undefined && maxAmount < 0) {
            throw new Error("Max amount must be non-negative");
        }
    }

    /**
     * Checks if the given amount falls within the range (if specified).
     */
    matchesAmount(amount?: number): boolean {
        if (amount === undefined) {
            return this.minAmount === undefined && this.maxAmount === undefined;
        }

        if (this.minAmount !== undefined && amount < this.minAmount) {
            return false;
        }

        if (this.maxAmount !== undefined && amount > this.maxAmount) {
            return false;
        }

        return true;
    }

    /**
     * Checks if the given currency matches (if specified).
     */
    matchesCurrency(currency?: string): boolean {
        if (this.currency === undefined) {
            return true; // No currency constraint
        }
        return currency === this.currency;
    }

    /**
     * Checks if the given variant matches (if specified).
     */
    matchesVariant(variant?: string): boolean {
        if (this.variant === undefined) {
            return true; // No variant constraint
        }
        return variant === this.variant;
    }

    /**
     * Checks if custom attributes match (if specified).
     * Custom attributes use AND logic - all specified attributes must match.
     */
    matchesCustomAttributes(customAttributes?: Record<string, unknown>): boolean {
        if (!this.customAttributes || Object.keys(this.customAttributes).length === 0) {
            return true; // No custom attribute constraints
        }

        if (!customAttributes) {
            return false; // Rule requires custom attributes but none provided
        }

        // All specified custom attributes must match
        for (const [key, value] of Object.entries(this.customAttributes)) {
            if (customAttributes[key] !== value) {
                return false;
            }
        }

        return true;
    }
}


