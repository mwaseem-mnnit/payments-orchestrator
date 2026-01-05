import {PaymentMethod} from "../../domain/payment_intent/PaymentMethod";
import {PaymentFlow} from "../../domain/payment_intent/PaymentIntent";

export class FetchTransactionStatusResult {
    constructor(
        public readonly transactionId: string,
        public readonly paymentIntentId: string,
        public readonly paymentFlowType: PaymentFlow,
        public readonly paymentMethod: PaymentMethod,
        public readonly status: string,
        public readonly amount: number,
        public readonly currency: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly gatewayMetadata?: Record<string, any>,
        public readonly gateway?: string
    ) {}
}

