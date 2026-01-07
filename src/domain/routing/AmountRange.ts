/**
 * Value object representing an amount range.
 * 
 * Invariants:
 * - Min amount must be <= max amount
 * - Amounts must be non-negative
 */
export class AmountRange {
    constructor(
        public readonly minAmount: number,
        public readonly maxAmount: number
    ) {
        if (minAmount < 0 || maxAmount < 0) {
            throw new Error("Amounts must be non-negative");
        }
        if (minAmount > maxAmount) {
            throw new Error("Min amount must be <= max amount");
        }
    }

    /**
     * Checks if the given amount falls within this range (inclusive).
     */
    contains(amount: number): boolean {
        return amount >= this.minAmount && amount <= this.maxAmount;
    }
}

