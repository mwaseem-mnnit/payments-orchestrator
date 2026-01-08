import Fastify, { FastifyInstance } from "fastify";
import { PaymentsController } from "./controllers/PaymentsController";
import { HealthController } from "./controllers/HealthController";
import { PayinService } from "../../application/services/PayinService";
import { PayoutService } from "../../application/services/PayoutService";
import { FetchTransactionStatusService } from "../../application/services/FetchTransactionStatusService";
import { ListTransactionsByUserService } from "../../application/services/ListTransactionsByUserService";
import { Clock } from "../../application/port/Clock";
import { IdGenerator } from "../../application/port/IdGenerator";
import {RequestSetupMiddleware} from "./middleware/RequestSetupMiddleware";

export class HttpServer {
    private readonly fastify: FastifyInstance;
    private readonly requestSetupMiddleware: RequestSetupMiddleware;
    private readonly paymentsController: PaymentsController;
    private readonly healthController: HealthController;

    constructor(
        payinService: PayinService,
        payoutService: PayoutService,
        fetchTransactionStatusService: FetchTransactionStatusService,
        listTransactionsByUserService: ListTransactionsByUserService,
        clock: Clock,
        idGenerator: IdGenerator
    ) {
        this.fastify = Fastify({
            logger: true,
        });

        this.requestSetupMiddleware = new RequestSetupMiddleware(
            clock,
            idGenerator
        );
        this.paymentsController = new PaymentsController(
            payinService,
            payoutService,
            fetchTransactionStatusService,
            listTransactionsByUserService
        );
        this.healthController = new HealthController();

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.fastify.addHook(
            "onRequest",
            this.requestSetupMiddleware.middleware()
        );
    }

    private setupRoutes(): void {
        this.fastify.get(
            "/health",
            this.healthController.healthCheck.bind(this.healthController)
        );

        this.fastify.post(
            "/v1/payment-intents",
            this.paymentsController.createPaymentPayin.bind(
                this.paymentsController
            )
        );

        this.fastify.post(
            "/v1/payouts",
            this.paymentsController.makePayout.bind(this.paymentsController)
        );

        this.fastify.get(
            "/v1/transactions/:transactionId",
            this.paymentsController.fetchTransactionStatus.bind(
                this.paymentsController
            )
        );

        this.fastify.get(
            "/v1/transactions",
            this.paymentsController.listTransactionsByUser.bind(
                this.paymentsController
            )
        );
    }

    async listen(port: number, host: string = "0.0.0.0"): Promise<void> {
        await this.fastify.listen({ port, host });
    }

    async close(): Promise<void> {
        await this.fastify.close();
    }

    getInstance(): FastifyInstance {
        return this.fastify;
    }
}

