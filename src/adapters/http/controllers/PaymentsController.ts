import {FastifyReply, FastifyRequest} from "fastify";
import {PayinService} from "../../../application/services/PayinService";
import {PayoutService} from "../../../application/services/PayoutService";
import {FetchTransactionStatusService} from "../../../application/services/FetchTransactionStatusService";
import {ListTransactionsByUserService} from "../../../application/services/ListTransactionsByUserService";

import {
    CreatePayinCommand,
    CreatePayoutCommand,
    PaymentMethodInput
} from "../../../application/commands/PaymentCommand";
import {FetchTransactionStatusCommand} from "../../../application/commands/FetchTransactionStatusCommand";
import {ListTransactionsByUserCommand} from "../../../application/commands/ListTransactionsByUserCommand";
import {OperationType, PaymentFlow, PaymentIntentState} from "../../../domain/payment_intent/PaymentIntent";

interface CreatePaymentIntentRequestBody {
    transactionId: string;
    amount: number;
    userIdentifier?: string;
    currency?: string;
    paymentMethodId?: string;
    paymentMethodInput?: PaymentMethodInput;
    preferredGateway?: string;
    gatewayContext?: Record<string, unknown>;
    additionalAttributes?: Record<string, any>;
}

interface MakePayoutRequestBody {
    transactionId: string;
    amount: number;
    userIdentifier?: string;
    currency?: string;
    paymentMethodId?: string;
    paymentMethodInput?: PaymentMethodInput;
    preferredGateway?: string;
    gatewayContext?: Record<string, unknown>;
    additionalAttributes?: Record<string, any>;
}

interface FetchTransactionStatusRequestParams {
    transactionId: string;
}

interface ListTransactionsByUserRequestQuery {
    userIdentifier: string;
    paymentFlowType?: string;
    status?: string;
    operationType?: string;
    paymentMethod?: string;
    minAmount?: string;
    maxAmount?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortOrder?: string;
    pageSize?: string;
    pageToken?: string;
}

export class PaymentsController {
    constructor(
        private readonly payinService: PayinService,
        private readonly makePayoutService: PayoutService,
        private readonly fetchTransactionStatusService: FetchTransactionStatusService,
        private readonly listTransactionsByUserService: ListTransactionsByUserService
    ) {}

    async createPaymentIntent(
        request: FastifyRequest<{
            Body: CreatePaymentIntentRequestBody;
        }>,
        reply: FastifyReply
    ): Promise<void> {
        const body = request.body;
        
        if (!body.userIdentifier) {
            await reply.code(400).send({ error: "userIdentifier is required" });
            return;
        }

        const command = new CreatePayinCommand(
            body.transactionId,
            body.amount,
            body.userIdentifier,
            body.currency,
            body.paymentMethodId,
            body.paymentMethodInput,
            body.preferredGateway,
            body.additionalAttributes
        );

        const result = await this.payinService.execute(command);

        await reply.code(200).send(result);
    }

    async makePayout(
        request: FastifyRequest<{
            Body: MakePayoutRequestBody;
        }>,
        reply: FastifyReply
    ): Promise<void> {
        const body = request.body;
        
        if (!body.userIdentifier) {
            await reply.code(400).send({ error: "userIdentifier is required" });
            return;
        }

        const command = new CreatePayoutCommand(
            body.transactionId,
            body.amount,
            body.userIdentifier,
            body.currency,
            body.paymentMethodId,
            body.paymentMethodInput,
            body.preferredGateway,
            body.additionalAttributes
        );

        const result = await this.makePayoutService.execute(command);

        await reply.code(200).send(result);
    }

    async fetchTransactionStatus(
        request: FastifyRequest<{
            Params: FetchTransactionStatusRequestParams;
        }>,
        reply: FastifyReply
    ): Promise<void> {
        const params = request.params;
        const command = new FetchTransactionStatusCommand(params.transactionId);

        const result = await this.fetchTransactionStatusService.execute(command);

        await reply.code(200).send(result);
    }

    async listTransactionsByUser(
        request: FastifyRequest<{
            Querystring: ListTransactionsByUserRequestQuery;
        }>,
        reply: FastifyReply
    ): Promise<void> {
        const query = request.query;
        const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
        const toDate = query.toDate ? new Date(query.toDate) : undefined;
        const minAmount = query.minAmount
            ? parseFloat(query.minAmount)
            : undefined;
        const maxAmount = query.maxAmount
            ? parseFloat(query.maxAmount)
            : undefined;
        const pageSize = query.pageSize
            ? parseInt(query.pageSize, 10)
            : undefined;

        const command = new ListTransactionsByUserCommand(
            query.userIdentifier,
            query.paymentFlowType as PaymentFlow | undefined,
            query.status as PaymentIntentState | undefined,
            query.operationType as OperationType | undefined,
            query.paymentMethod,
            minAmount,
            maxAmount,
            fromDate,
            toDate,
            query.sortBy as "createdAt" | "amount" | "updatedAt" | undefined,
            query.sortOrder as "ASC" | "DESC" | undefined,
            pageSize,
            query.pageToken
        );

        const result = await this.listTransactionsByUserService.execute(command);

        await reply.code(200).send(result);
    }

}

