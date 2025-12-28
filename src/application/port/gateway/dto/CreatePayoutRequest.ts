import { PaymentIntent } from "../../../../domain/payment_intent/PaymentIntent";

export class CreatePayoutRequest {
    constructor(
        public readonly paymentIntent: PaymentIntent,
        public readonly customerData?: Record<string, any>,
        public readonly beneficiaryDetails?: Record<string, any>
    ) {}
}

