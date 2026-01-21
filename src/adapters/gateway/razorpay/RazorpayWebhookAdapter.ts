import crypto from "crypto";
import {PaymentFact, PaymentFactCanonicalStatus} from "../../../domain/payment_fact/PaymentFact";
import {GatewayWebhookPort} from "../../../application/port/GatewayWebhookPort";
import {IdGenerator} from "../../../application/port/IdGenerator";
import {Clock} from "../../../application/port/Clock";
import {Logger} from "../../../application/port/Logger";
import {PaymentFlow} from "../../../domain/payment_intent/PaymentIntent";

class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthenticationError";
    }
}

class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

type RazorpayWebhookPayload = {
    id?: string;
    event?: string;
    created_at?: number;
    payload?: Record<string, unknown>;
};

export class RazorpayWebhookAdapter implements GatewayWebhookPort {
    constructor(
        private readonly webhookSecret: string,
        private readonly gatewayId: string,
        private readonly idGenerator: IdGenerator,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {
        if (this.gatewayId !== "RAZORPAY") {
            throw new Error("gatewayId must be RAZORPAY for RazorpayWebhookAdapter");
        }
    }

    getGatewayId(): string {
        return this.gatewayId;
    }

    verifySignature(headers: Record<string, string>, rawPayload: unknown): void {
        const signature = headers["razorpay-signature"];
        const payloadString = this.toPayloadString(rawPayload);

        const computedSignature = crypto
            .createHmac("sha256", this.webhookSecret)
            .update(payloadString, "utf8")
            .digest("hex");

        if (!signature || signature !== computedSignature) {
            this.logger.warn("Razorpay webhook signature verification failed", {
                gatewayId: this.gatewayId
            });
            throw new AuthenticationError("Invalid Razorpay webhook signature");
        }

        this.logger.info("Razorpay webhook signature verified", {
            gatewayId: this.gatewayId
        });
    }

    parseAndNormalize(
        headers: Record<string, string>,
        rawPayload: unknown
    ): PaymentFact {
        const payload = this.parsePayload(rawPayload);
        const eventType = this.extractEventType(payload);
        const paymentFlow = this.mapPaymentFlow(eventType);
        const canonicalStatus = this.mapCanonicalStatus(eventType, paymentFlow);
        const transactionId = this.extractTransactionId(payload, paymentFlow);
        const gatewayTransactionReference =
            this.extractGatewayTransactionReference(payload, paymentFlow);
        const sourceReference = typeof payload.id === "string" ? payload.id : undefined;
        const occurredAt = this.parseOccurredAt(payload);

        const metadata: Record<string, unknown> = {
            rawPayload: rawPayload,
            razorpayEventType: eventType
        };

        const razorpayStatus = this.extractRazorpayStatus(payload, paymentFlow);
        if (razorpayStatus) {
            metadata.razorpayStatus = razorpayStatus;
        }

        return new PaymentFact(
            this.idGenerator.generate(),
            transactionId,
            paymentFlow,
            "GATEWAY_WEBHOOK",
            sourceReference,
            this.gatewayId,
            gatewayTransactionReference,
            canonicalStatus,
            occurredAt,
            this.clock.now(),
            metadata,
            "NEW"
        );
    }

    private toPayloadString(rawPayload: unknown): string {
        if (typeof rawPayload === "string") {
            return rawPayload;
        }

        if (Buffer.isBuffer(rawPayload)) {
            return rawPayload.toString("utf8");
        }

        throw new AuthenticationError("Raw payload must be a string or buffer");
    }

    private parsePayload(rawPayload: unknown): RazorpayWebhookPayload {
        try {
            if (typeof rawPayload === "string") {
                return JSON.parse(rawPayload) as RazorpayWebhookPayload;
            }

            if (Buffer.isBuffer(rawPayload)) {
                return JSON.parse(rawPayload.toString("utf8")) as RazorpayWebhookPayload;
            }

            if (rawPayload && typeof rawPayload === "object") {
                return rawPayload as RazorpayWebhookPayload;
            }
        } catch (error) {
            this.logger.warn("Razorpay webhook payload parse failed", {
                gatewayId: this.gatewayId
            });
            throw new ValidationError("Invalid Razorpay webhook payload");
        }

        this.logger.warn("Razorpay webhook payload parse failed", {
            gatewayId: this.gatewayId
        });
        throw new ValidationError("Invalid Razorpay webhook payload");
    }

    private extractEventType(payload: RazorpayWebhookPayload): string {
        if (!payload.event || typeof payload.event !== "string") {
            this.logger.warn("Razorpay webhook event missing", {
                gatewayId: this.gatewayId
            });
            throw new ValidationError("Razorpay webhook event is missing");
        }

        return payload.event;
    }

    private mapPaymentFlow(eventType: string): PaymentFlow {
        if (eventType.startsWith("payout.")) {
            return "PAYOUT";
        }

        if (eventType.startsWith("payment.") || eventType.startsWith("order.")) {
            return "PAYIN";
        }

        throw new ValidationError("Unsupported Razorpay webhook event");
    }

    private mapCanonicalStatus(
        eventType: string,
        paymentFlow: PaymentFlow
    ): PaymentFactCanonicalStatus {
        if (paymentFlow === "PAYIN") {
            if (eventType === "payment.captured" || eventType === "order.paid") {
                return "SUCCESS";
            }

            if (eventType === "payment.failed") {
                return "FAILED";
            }
        }

        if (paymentFlow === "PAYOUT") {
            if (eventType === "payout.processed") {
                return "SUCCESS";
            }

            if (eventType === "payout.failed") {
                return "FAILED";
            }

            if (eventType === "payout.reversed") {
                return "REVERSED";
            }
        }

        throw new ValidationError("Unsupported Razorpay webhook event");
    }

    private extractTransactionId(
        payload: RazorpayWebhookPayload,
        paymentFlow: PaymentFlow
    ): string {
        const receipt =
            (payload.payload?.order as Record<string, any> | undefined)?.entity
                ?.receipt ??
            (payload.payload?.payment as Record<string, any> | undefined)?.entity
                ?.receipt;

        const referenceId =
            (payload.payload?.payout as Record<string, any> | undefined)?.entity
                ?.reference_id;

        const transactionId =
            paymentFlow === "PAYIN" ? receipt : referenceId;

        if (!transactionId || typeof transactionId !== "string") {
            this.logger.warn("Razorpay webhook missing transactionId", {
                gatewayId: this.gatewayId
            });
            throw new ValidationError("Razorpay webhook missing transactionId");
        }

        return transactionId;
    }

    private extractGatewayTransactionReference(
        payload: RazorpayWebhookPayload,
        paymentFlow: PaymentFlow
    ): string | undefined {
        if (paymentFlow === "PAYOUT") {
            const payoutId =
                (payload.payload?.payout as Record<string, any> | undefined)?.entity
                    ?.id;
            return typeof payoutId === "string" ? payoutId : undefined;
        }

        const paymentId =
            (payload.payload?.payment as Record<string, any> | undefined)?.entity
                ?.id;
        if (typeof paymentId === "string") {
            return paymentId;
        }

        const orderId =
            (payload.payload?.order as Record<string, any> | undefined)?.entity
                ?.id;
        return typeof orderId === "string" ? orderId : undefined;
    }

    private extractRazorpayStatus(
        payload: RazorpayWebhookPayload,
        paymentFlow: PaymentFlow
    ): string | undefined {
        if (paymentFlow === "PAYOUT") {
            const payoutStatus =
                (payload.payload?.payout as Record<string, any> | undefined)?.entity
                    ?.status;
            return typeof payoutStatus === "string" ? payoutStatus : undefined;
        }

        const paymentStatus =
            (payload.payload?.payment as Record<string, any> | undefined)?.entity
                ?.status;
        return typeof paymentStatus === "string" ? paymentStatus : undefined;
    }

    private parseOccurredAt(payload: RazorpayWebhookPayload): Date | undefined {
        const createdAt = payload.created_at;
        if (typeof createdAt === "number") {
            const millis =
                createdAt < 1000000000000 ? createdAt * 1000 : createdAt;
            return this.clock.fromEpochMillis(millis);
        }

        return undefined;
    }
}
