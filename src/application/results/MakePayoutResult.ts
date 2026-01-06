import { PaymentMethod } from "../../domain/payment_method/PaymentMethod";

export class MakePayoutResult {
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

