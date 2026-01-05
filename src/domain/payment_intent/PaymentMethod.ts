import {PaymentFlow} from "./PaymentIntent";

export type PaymentMethodStatus = "ACTIVE" | "INACTIVE" | "INVALID";

export type IdentifierType =
    | "UPI_VPA"
    | "BANK_ACCOUNT"
    | "EMAIL"
    | "MOBILE"
    | "CARD_INSTRUMENT";

export class PaymentMethodIdentifier {
    constructor(
        public readonly paymentMethodId: string,
        public readonly identifierType: IdentifierType,
        public readonly identifierValue: string,
        public readonly normalizedValue: string
    ) {}
}

export class PaymentMethod {
    constructor(
        public readonly paymentMethodId: string,
        public readonly userId: string,
        public readonly paymentFlow: PaymentFlow,
        public readonly methodTypeId: string,
        public readonly variant: string | undefined,
        public readonly status: PaymentMethodStatus,
        public readonly reusable: boolean,
        public readonly usageCount: number,
        public readonly lastUsedAt: Date | undefined,
        public readonly gatewayRefs: Record<string, Record<string, string>> | undefined,
        public readonly identifiers: PaymentMethodIdentifier[]
    ) {}
}
