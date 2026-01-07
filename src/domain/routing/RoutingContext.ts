import { PaymentFlow, OperationType } from "../payment_intent/PaymentIntent";

/**
 * Value object representing the context for a routing decision.
 * Contains all canonical inputs that routing may consider.
 * 
 * Invariants:
 * - All fields must be valid and non-null
 * - Routing must not depend on gateway-specific runtime behavior
 * - Non-deterministic signals are forbidden
 */
export class RoutingContext {
    constructor(
        public readonly paymentFlowType: PaymentFlow,
        public readonly operationType: OperationType,
        public readonly amount: number,
        public readonly currency: string,
        public readonly region?: string,
        public readonly payerReference?: string,
        public readonly payeeReference?: string,
        public readonly paymentMethodId?: string,
        public readonly paymentMethodTypeId?: string
    ) {}

    /**
     * Creates a copy of this context with updated fields.
     * Used for building context incrementally.
     */
    withRegion(region: string): RoutingContext {
        return new RoutingContext(
            this.paymentFlowType,
            this.operationType,
            this.amount,
            this.currency,
            region,
            this.payerReference,
            this.payeeReference,
            this.paymentMethodId,
            this.paymentMethodTypeId
        );
    }
}

