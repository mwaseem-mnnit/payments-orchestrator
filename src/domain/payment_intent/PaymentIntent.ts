export type PaymentFlow = "PAYIN" | "PAYOUT" | "REFUND";
export type OperationType = "CHARGE" | "AUTHORIZE" | "CAPTURE" | "VOID" | "PAYOUT" | "REFUND";
export type PaymentIntentState =
    | "CREATED"
    | "GATEWAY_SELECTED"
    | "GATEWAY_INITIATED"
    | "AUTHORIZATION_PENDING"
    | "AUTHORIZED"
    | "CAPTURE_PENDING"
    | "PROCESSING"
    | "REVERSED"
    | "SUCCEEDED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";

export type FailureCategory =
    | "USER_ERROR"
    | "GATEWAY_ERROR"
    | "SYSTEM_ERROR"
    | "TIMEOUT"
    | "COMPLIANCE_BLOCK";

export class PaymentIntent {
    constructor(
        public readonly paymentIntentId: string,
        public readonly paymentFlowType: PaymentFlow,
        public readonly operationType: OperationType,
        public readonly amount: number,
        public readonly currency: string,
        public readonly state: PaymentIntentState,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly transactionId: string,
        public readonly paymentMethodId: string,
        public readonly gateway?: string,
        public readonly gatewayTransactionReference?: string,
        public readonly payerReference?: string,
        public readonly payeeReference?: string,
        public readonly failureCategory?: FailureCategory,
        public readonly failureReason?: string,
        public readonly additionalAttributes?: Record<string, any>
    ) {}

    withState(newState: PaymentIntentState): PaymentIntent {
        return new PaymentIntent(
            this.paymentIntentId,
            this.paymentFlowType,
            this.operationType,
            this.amount,
            this.currency,
            newState,
            this.createdAt,
            new Date(),
            this.transactionId,
            this.paymentMethodId,
            this.gateway,
            this.gatewayTransactionReference,
            this.payerReference,
            this.payeeReference,
            this.failureCategory,
            this.failureReason,
            this.additionalAttributes
        );
    }

    withGateway(gateway: string): PaymentIntent {
        return new PaymentIntent(
            this.paymentIntentId,
            this.paymentFlowType,
            this.operationType,
            this.amount,
            this.currency,
            this.state,
            this.createdAt,
            new Date(),
            this.transactionId,
            this.paymentMethodId,
            gateway,
            this.gatewayTransactionReference,
            this.payerReference,
            this.payeeReference,
            this.failureCategory,
            this.failureReason,
            this.additionalAttributes
        );
    }

    withGatewayTransactionReference(
        gatewayTransactionReference: string
    ): PaymentIntent {
        return new PaymentIntent(
            this.paymentIntentId,
            this.paymentFlowType,
            this.operationType,
            this.amount,
            this.currency,
            this.state,
            this.createdAt,
            new Date(),
            this.transactionId,
            this.paymentMethodId,
            this.gateway,
            gatewayTransactionReference,
            this.payerReference,
            this.payeeReference,
            this.failureCategory,
            this.failureReason,
            this.additionalAttributes
        );
    }
}

