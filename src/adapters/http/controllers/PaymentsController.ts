import { FastifyRequest, FastifyReply } from "fastify";
import { CreatePaymentIntentService } from "../../../application/services/CreatePaymentIntentService";
import { MakePayoutService } from "../../../application/services/MakePayoutService";
import { FetchTransactionStatusService } from "../../../application/services/FetchTransactionStatusService";
import { ListTransactionsByUserService } from "../../../application/services/ListTransactionsByUserService";
import { CreatePaymentIntentCommand } from "../../../application/commands/CreatePaymentIntentCommand";
import { MakePayoutCommand } from "../../../application/commands/MakePayoutCommand";
import { FetchTransactionStatusCommand } from "../../../application/commands/FetchTransactionStatusCommand";
import { ListTransactionsByUserCommand } from "../../../application/commands/ListTransactionsByUserCommand";
import { PaymentMethod } from "../../../domain/payment_intent/PaymentMethod";
import { PaymentFlowType, OperationType, PaymentIntentState } from "../../../domain/payment_intent/PaymentIntent";

interface CreatePaymentIntentRequestBody {
    transactionId: string;
    amount: number;
    paymentMethod: string;
    currency?: string;
    userIdentifier?: string;
    customerData?: Record<string, any>;
    cardData?: Record<string, any>;
    paymentGateway?: string;
    additionalAttributes?: Record<string, any>;
}

interface MakePayoutRequestBody {
    transactionId: string;
    amount: number;
    paymentMethod: string;
    currency?: string;
    userIdentifier?: string;
    customerData?: Record<string, any>;
    beneficiaryDetails?: Record<string, any>;
    paymentGateway?: string;
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
        private readonly createPaymentIntentService: CreatePaymentIntentService,
        private readonly makePayoutService: MakePayoutService,
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
        const command = new CreatePaymentIntentCommand(
            body.transactionId,
            body.amount,
            body.paymentMethod as PaymentMethod,
            body.currency,
            body.userIdentifier,
            body.customerData,
            body.cardData,
            body.paymentGateway,
            body.additionalAttributes
        );

        const result = await this.createPaymentIntentService.execute(command);

        await reply.code(200).send(result);
    }

    async makePayout(
        request: FastifyRequest<{
            Body: MakePayoutRequestBody;
        }>,
        reply: FastifyReply
    ): Promise<void> {
        const body = request.body;
        const command = new MakePayoutCommand(
            body.transactionId,
            body.amount,
            body.paymentMethod as PaymentMethod,
            body.currency,
            body.userIdentifier,
            body.customerData,
            body.beneficiaryDetails,
            body.paymentGateway,
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
            query.paymentFlowType as PaymentFlowType | undefined,
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

