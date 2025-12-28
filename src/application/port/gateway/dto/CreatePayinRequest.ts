import { PaymentIntent } from "../../../../domain/payment_intent/PaymentIntent";

export class CreatePayinRequest {
    constructor(
        public readonly paymentIntent: PaymentIntent,
        public readonly customerData?: Record<string, any>,
        public readonly cardData?: Record<string, any>
    ) {}
}

