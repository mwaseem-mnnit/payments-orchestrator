/* 
 *   created by mohdwaseem
 *   created on 18/01/26 8:05pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import {PaymentFlow} from "../payment_intent/PaymentIntent";

export type PaymentFactSource = "GATEWAY_WEBHOOK" | "GATEWAY_POLLER" | "BACKOFFICE" | "SYSTEM";
export type PaymentFactCanonicalStatus = "INITIATED" | "PENDING" | "SUCCESS" | "FAILED" | "REVERSED" | "CANCELLED";
export class PaymentFact {
    constructor(
        public readonly factId: string,
        public readonly transactionId: string,
        public readonly paymentFlow: PaymentFlow,
        public readonly source: PaymentFactSource,
        public readonly sourceReference: string | undefined,
        public readonly gatewayId: string | undefined,
        public readonly gatewayTransactionReference: string | undefined,
        public readonly canonicalStatus: PaymentFactCanonicalStatus ,
        public readonly occurredAt: Date | undefined,
        public readonly receivedAt: Date,
        public readonly metadata: Record<string, unknown>,
        public readonly processingOutcome: "NEW" | "PROCESSED" | "IGNORED" | "ORPHANED"
    ) {}
}
