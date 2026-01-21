import {PaymentFact} from "../../domain/payment_fact/PaymentFact";

export interface GatewayWebhookPort {
    getGatewayId(): string;

    verifySignature(
        headers: Record<string, string>,
        rawPayload: unknown
    ): void;

    parseAndNormalize(
        headers: Record<string, string>,
        rawPayload: unknown
    ): PaymentFact;
}
