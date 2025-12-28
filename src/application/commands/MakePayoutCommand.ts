import { PaymentMethod } from "../../domain/payment_intent/PaymentMethod";

export class MakePayoutCommand {
    constructor(
        public readonly transactionId: string,
        public readonly amount: number,
        public readonly paymentMethod: PaymentMethod,
        public readonly currency?: string,
        public readonly userIdentifier?: string,
        public readonly customerData?: Record<string, any>,
        public readonly beneficiaryDetails?: Record<string, any>,
        public readonly paymentGateway?: string,
        public readonly additionalAttributes?: Record<string, any>
    ) {}
}

