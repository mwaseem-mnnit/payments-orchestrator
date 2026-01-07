import { RoutingDecision } from "../RoutingDecision";

/**
 * Domain event emitted when a routing decision is made.
 * 
 * Invariants:
 * - Must include the complete routing decision
 * - Must be emitted for auditability
 */
export class RoutingDecisionMade {
    constructor(
        public readonly eventId: string,
        public readonly paymentIntentId: string,
        public readonly transactionId: string,
        public readonly decision: RoutingDecision,
        public readonly decidedAt: Date
    ) {}
}

