import { RoutingContext } from "./RoutingContext";

/**
 * Entity representing a routing decision result.
 * 
 * Invariants:
 * - Must have exactly one selected gateway or be null (no gateway could be selected)
 * - Must reference the rule that made the decision
 * - Must include explanation for auditability
 * - Is immutable once created
 */
export class RoutingDecision {
    constructor(
        public readonly selectedGateway: string | null,
        public readonly ruleId: string,
        public readonly ruleVersion: number,
        public readonly ruleType: string,
        public readonly explanation: string,
        public readonly routingContext: RoutingContext,
        public readonly eligibleGateways: string[],
        public readonly excludedGateways: string[],
        public readonly fallbackReason?: string,
        public readonly decidedAt: Date = new Date()
    ) {}

    /**
     * Creates a decision indicating no gateway could be selected.
     */
    static noGatewayAvailable(
        ruleId: string | null,
        ruleVersion: number | null,
        routingContext: RoutingContext,
        eligibleGateways: string[],
        excludedGateways: string[],
        reason: string
    ): RoutingDecision {
        return new RoutingDecision(
            null,
            ruleId || "NONE",
            ruleVersion || 0,
            "NONE",
            `No gateway available: ${reason}`,
            routingContext,
            eligibleGateways,
            excludedGateways,
            reason
        );
    }

    /**
     * Creates a decision with fallback information.
     */
    static withFallback(
        selectedGateway: string,
        ruleId: string,
        ruleVersion: number,
        ruleType: string,
        explanation: string,
        routingContext: RoutingContext,
        eligibleGateways: string[],
        excludedGateways: string[],
        fallbackReason: string
    ): RoutingDecision {
        return new RoutingDecision(
            selectedGateway,
            ruleId,
            ruleVersion,
            ruleType,
            explanation,
            routingContext,
            eligibleGateways,
            excludedGateways,
            fallbackReason
        );
    }

    /**
     * Checks if a gateway was successfully selected.
     */
    hasGateway(): boolean {
        return this.selectedGateway !== null;
    }
}

