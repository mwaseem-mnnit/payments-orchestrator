import { PaymentIntent } from "../payment_intent/PaymentIntent";

export class GatewayOrderRequest {
    constructor(
        public readonly paymentIntent: PaymentIntent,
        public readonly customerData?: Record<string, any>,
        public readonly cardData?: Record<string, any>
    ) {}
}

