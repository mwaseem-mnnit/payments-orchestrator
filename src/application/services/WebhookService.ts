import {PaymentFact} from "../../domain/payment_fact/PaymentFact";
import {GatewayAdapterRegistry} from "../port/GatewayAdapterRegistry";
import {PaymentFactsRepository} from "../port/PaymentFactsRepository";
import {Logger} from "../port/Logger";
import {ProcessPaymentFactUpdateService} from "./ProcessPaymentFactUpdateService";
import {AuthenticationError} from "../../errors/AuthenticationError";
import {ValidationError} from "../../errors/ValidationError";

export class WebhookService {
    constructor(
        private readonly gatewayWebhookAdapterRegistry: GatewayAdapterRegistry,
        private readonly paymentFactsRepository: PaymentFactsRepository,
        private readonly processPaymentFactUpdateService: ProcessPaymentFactUpdateService,
        private readonly logger: Logger
    ) {}

    async handleWebhook(
        gatewayId: string,
        headers: Record<string, string>,
        rawPayload: unknown
    ): Promise<void> {
        let paymentFact: PaymentFact | undefined;

        this.logger.info("Webhook received", {gatewayId});

        try {
            const adapter =
                this.gatewayWebhookAdapterRegistry.getWebhookAdapter(gatewayId);

            if (!adapter) {
                throw new ValidationError(
                    `No webhook adapter registered for gatewayId: ${gatewayId}`
                );
            }

            adapter.verifySignature(headers, rawPayload);

            paymentFact = adapter.parseAndNormalize(headers, rawPayload);

            const result = await this.paymentFactsRepository.create(paymentFact);

            if (!result.created) {
                this.logger.info("Duplicate PaymentFact ignored", {
                    gatewayId,
                    transactionId: paymentFact.transactionId,
                    gatewayTransactionReference:
                        paymentFact.gatewayTransactionReference
                });
                return;
            }

            await this.processPaymentFactUpdateService.execute(paymentFact.factId);
        } catch (error) {
            this.logWebhookError(gatewayId, paymentFact, error);

            if (error instanceof AuthenticationError) {
                throw error;
            }

            if (error instanceof ValidationError) {
                throw error;
            }

            throw error;
        }
    }

    private logWebhookError(
        gatewayId: string,
        paymentFact: PaymentFact | undefined,
        error: unknown
    ): void {
        this.logger.error(
            "Webhook processing failed",
            error instanceof Error ? error : undefined,
            {
                gatewayId,
                transactionId: paymentFact?.transactionId,
                gatewayTransactionReference:
                    paymentFact?.gatewayTransactionReference
            }
        );
    }
}
