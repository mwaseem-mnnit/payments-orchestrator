import { PaymentMethod } from "../../domain/payment_intent/PaymentMethod";

export class CreatePaymentIntentResult {
    constructor(
        public readonly transactionId: string,
        public readonly paymentIntentId: string,
        public readonly paymentMethod: PaymentMethod,
        public readonly status: string,
        public readonly amount: number,
        public readonly currency: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly gateway?: string
    ) {}
}

