import {FastifyReply, FastifyRequest} from "fastify";
import {WebhookService} from "../../../application/services/WebhookService";
import {Logger} from "../../../application/port/Logger";
import {Clock} from "../../../application/port/Clock";
import {AuthenticationError} from "../../../errors/AuthenticationError";
import {ValidationError} from "../../../errors/ValidationError";
import {requestContextStore} from "../RequestContext";

type WebhookRequestParams = {
    gatewayId: string;
};

export class WebhookController {
    constructor(
        private readonly webhookService: WebhookService,
        private readonly logger: Logger,
        private readonly clock: Clock
    ) {
        if (!webhookService) {
            throw new Error("WebhookService must be provided");
        }
        if (!logger) {
            throw new Error("Logger must be provided");
        }
        if (!clock) {
            throw new Error("Clock must be provided");
        }
    }

    // Raw request body is required for webhook signature verification.
    // Do NOT parse body before passing to WebhookService.
    // Direct Date usage is forbidden. Use Clock.
    async handleWebhook(
        request: FastifyRequest<{Params: WebhookRequestParams}>,
        reply: FastifyReply
    ): Promise<void> {
        const gatewayId = request.params.gatewayId;
        const correlationId =
            requestContextStore.getContext()?.correlationId ||
            (request.headers["x-correlation-id"] as string | undefined);

        this.logger.info("Webhook request received", {
            gatewayId,
            correlationId
        });

        const rawBody = request.body;
        if (typeof rawBody !== "string" && !Buffer.isBuffer(rawBody)) {
            this.logger.warn("Webhook raw body missing or invalid", {
                gatewayId,
                correlationId
            });
            await reply.code(400).send();
            return;
        }

        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(request.headers)) {
            if (typeof value === "string") {
                headers[key] = value;
            } else if (Array.isArray(value)) {
                headers[key] = value.join(",");
            }
        }

        try {
            await this.webhookService.handleWebhook(gatewayId, headers, rawBody);
            await reply.code(200).send();
        } catch (error) {
            if (error instanceof AuthenticationError) {
                this.logger.warn("Webhook authentication failed", {
                    gatewayId,
                    correlationId
                });
                await reply.code(401).send();
                return;
            }

            if (error instanceof ValidationError) {
                this.logger.warn("Webhook validation failed", {
                    gatewayId,
                    correlationId
                });
                await reply.code(400).send();
                return;
            }

            this.logger.error(
                "Webhook processing failed",
                error instanceof Error ? error : undefined,
                {
                    gatewayId,
                    correlationId
                }
            );
            await reply.code(500).send();
        }
    }
}
