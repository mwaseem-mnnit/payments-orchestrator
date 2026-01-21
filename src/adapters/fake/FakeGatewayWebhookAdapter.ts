import {GatewayWebhookPort} from "../../application/port/GatewayWebhookPort";
import {Clock} from "../../application/port/Clock";
import {IdGenerator} from "../../application/port/IdGenerator";
import {
    PaymentFact,
    PaymentFactCanonicalStatus
} from "../../domain/payment_fact/PaymentFact";
import {PaymentFlow} from "../../domain/payment_intent/PaymentIntent";

type FakeWebhookPayload = {
    transactionId: string;
    paymentFlow: PaymentFlow;
    canonicalStatus: PaymentFactCanonicalStatus;
    gatewayTransactionReference?: string;
};

export class FakeGatewayWebhookAdapter implements GatewayWebhookPort {
    constructor(
        private readonly gatewayId: string,
        private readonly clock: Clock,
        private readonly idGenerator: IdGenerator
    ) {}

    getGatewayId(): string {
        return this.gatewayId;
    }

    verifySignature(
        _headers: Record<string, string>,
        _rawPayload: unknown
    ): void {}

    parseAndNormalize(
        _headers: Record<string, string>,
        rawPayload: unknown
    ): PaymentFact {
        const payload = rawPayload as FakeWebhookPayload;

        return new PaymentFact(
            this.idGenerator.generate(),
            payload.transactionId,
            payload.paymentFlow,
            "SYSTEM",
            "FAKE",
            this.gatewayId,
            payload.gatewayTransactionReference,
            payload.canonicalStatus,
            undefined,
            this.clock.now(),
            rawPayload as Record<string, unknown>,
            "NEW"
        );
    }
}
