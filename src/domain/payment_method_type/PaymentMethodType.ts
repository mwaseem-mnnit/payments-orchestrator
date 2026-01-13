/* 
 *   created by mohdwaseem
 *   created on 07/01/26 7:46pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import { PaymentFlow } from "../payment_intent/PaymentIntent";

export type PaymentMethodTypeStatus = "ACTIVE" | "INACTIVE";

export type IdentifierType =
    | "UPI_VPA"
    | "BANK_ACCOUNT"
    | "IFSC"
    | "EMAIL"
    | "MOBILE"
    | "CARD_INSTRUMENT";

export type IdentityRequirement = "NONE" | "OPTIONAL" | "REQUIRED";

export interface IdentityDefinition {
    type: "DEFAULT" | "CUSTOM";
    identifierTypes?: IdentifierType[];
}

export class PaymentMethodType {
    constructor(
        public readonly methodTypeId: string,            // e.g. "UPI", "BANK"
        public readonly displayName: string,              // "UPI", "Bank Account"
        public readonly status: PaymentMethodTypeStatus,
        public readonly supportedFlows: PaymentFlow[],    // PAYIN, PAYOUT
        public readonly allowedIdentifierTypes: IdentifierType[],
        public readonly supportsVariants: boolean,        // PhonePe, GPay, etc.
        public readonly identityRequirement: IdentityRequirement,
        public readonly identityDefinition: IdentityDefinition,
        public readonly executionMode: "SDK_DRIVEN" | "BACKEND_DRIVEN",
        public readonly metadata: Record<string, unknown> // icons, UI hints
    ) {}
}
