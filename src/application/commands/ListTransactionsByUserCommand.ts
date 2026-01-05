import { PaymentFlow, OperationType, PaymentIntentState } from "../../domain/payment_intent/PaymentIntent";

export class ListTransactionsByUserCommand {
    constructor(
        public readonly userIdentifier: string,
        public readonly paymentFlowType?: PaymentFlow,
        public readonly status?: PaymentIntentState,
        public readonly operationType?: OperationType,
        public readonly paymentMethod?: string,
        public readonly minAmount?: number,
        public readonly maxAmount?: number,
        public readonly fromDate?: Date,
        public readonly toDate?: Date,
        public readonly sortBy?: "createdAt" | "amount" | "updatedAt",
        public readonly sortOrder?: "ASC" | "DESC",
        public readonly pageSize?: number,
        public readonly pageToken?: string
    ) {}
}

