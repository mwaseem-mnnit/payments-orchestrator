/**
 * Value object representing a gateway with its distribution percentage.
 * 
 * Invariants:
 * - Percentage must be between 0 and 100
 * - Gateway ID must be non-empty
 */
export class GatewayDistribution {
    constructor(
        public readonly gatewayId: string,
        public readonly percentage: number
    ) {
        if (percentage < 0 || percentage > 100) {
            throw new Error("Percentage must be between 0 and 100");
        }
        if (!gatewayId || gatewayId.trim().length === 0) {
            throw new Error("Gateway ID must be non-empty");
        }
    }
}

