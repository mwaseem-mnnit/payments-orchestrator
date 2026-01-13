import {PaymentFlow} from "../payment_intent/PaymentIntent";
import { IdentifierType } from "../payment_method_type/PaymentMethodType";

export type PaymentMethodStatus = "ACTIVE" | "INACTIVE" | "INVALID";

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
        public readonly userIdentifier: string,
        public readonly paymentFlow: PaymentFlow,
        public readonly methodTypeId: string,
        public readonly variant: string | undefined,
        public readonly status: PaymentMethodStatus,
        public readonly reusable: boolean,
        public readonly identityKey: string | undefined,
        public readonly usageCount: number,
        public readonly lastUsedAt: Date | undefined,
        public readonly identifiers: PaymentMethodIdentifier[]
    ) {}
}
