import { FastifyReply, FastifyRequest } from "fastify";
import { FetchPaymentCapabilitiesService } from "../../../application/services/FetchPaymentCapabilitiesService";
import { PaymentFlow } from "../../../domain/payment_intent/PaymentIntent";
import { PaymentMethodStatus } from "../../../domain/payment_method/PaymentMethod";

interface FetchPaymentCapabilitiesRequestQuery {
    paymentFlow?: string;
    status?: string;
}

/**
 * Controller for fetching payment capabilities.
 * 
 * This controller handles the HTTP request/response translation for
 * the FetchPaymentCapabilities API.
 */
export class FetchPaymentCapabilitiesController {
    constructor(private readonly fetchPaymentCapabilitiesService: FetchPaymentCapabilitiesService) {
        if (!fetchPaymentCapabilitiesService) {
            throw new Error("FetchPaymentCapabilitiesService must be provided");
        }
    }

    /**
     * Handles GET request to fetch payment capabilities.
     * 
     * Query parameters:
     * - paymentFlow (optional): PAYIN | PAYOUT
     * - status (optional): ACTIVE | INACTIVE (defaults to ACTIVE)
     * 
     * The userIdentifier should be extracted from auth/context middleware.
     * For now, we'll expect it in a header or query param, but in production
     * it should come from authenticated context.
     */
    async fetchPaymentCapabilities(
        request: FastifyRequest<{
            Querystring: FetchPaymentCapabilitiesRequestQuery;
        }>,
        reply: FastifyReply
    ): Promise<void> {
        // Extract userIdentifier from request context or header
        // TODO: This should come from authenticated context middleware
        const userIdentifier = (request.headers["x-user-id"] as string) || 
                              (request.query as any).userIdentifier;

        if (!userIdentifier) {
            await reply.code(400).send({
                error: "userIdentifier is required",
                code: "VALIDATION_ERROR",
            });
            return;
        }

        // Validate and parse paymentFlow
        let paymentFlow: PaymentFlow | undefined;
        if (request.query.paymentFlow) {
            const flow = request.query.paymentFlow.toUpperCase();
            if (flow !== "PAYIN" && flow !== "PAYOUT") {
                await reply.code(400).send({
                    error: `Invalid paymentFlow: ${request.query.paymentFlow}. Must be PAYIN or PAYOUT`,
                    code: "VALIDATION_ERROR",
                });
                return;
            }
            paymentFlow = flow as PaymentFlow;
        }

        // Validate and parse status
        let status: PaymentMethodStatus | undefined;
        if (request.query.status) {
            const statusValue = request.query.status.toUpperCase();
            if (statusValue !== "ACTIVE" && statusValue !== "INACTIVE") {
                await reply.code(400).send({
                    error: `Invalid status: ${request.query.status}. Must be ACTIVE or INACTIVE`,
                    code: "VALIDATION_ERROR",
                });
                return;
            }
            status = statusValue as PaymentMethodStatus;
        }

        try {
            const result = await this.fetchPaymentCapabilitiesService.execute(
                userIdentifier,
                paymentFlow,
                status
            );

            await reply.code(200).send(result);
        } catch (error) {
            // Log error
            if (error instanceof Error) {
                await reply.code(500).send({
                    error: "Failed to fetch payment capabilities",
                    code: "SYSTEM_ERROR",
                });
            } else {
                await reply.code(500).send({
                    error: "Unknown error occurred",
                    code: "SYSTEM_ERROR",
                });
            }
        }
    }
}
