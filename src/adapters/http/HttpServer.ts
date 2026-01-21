import Fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {PaymentsController} from "./controllers/PaymentsController";
import {HealthController} from "./controllers/HealthController";
import {FetchPaymentCapabilitiesController} from "./controllers/FetchPaymentCapabilitiesController";
import {WebhookController} from "./controllers/WebhookController";
import {PayinService} from "../../application/services/PayinService";
import {PayoutService} from "../../application/services/PayoutService";
import {FetchTransactionStatusService} from "../../application/services/FetchTransactionStatusService";
import {ListTransactionsByUserService} from "../../application/services/ListTransactionsByUserService";
import {FetchPaymentCapabilitiesService} from "../../application/services/FetchPaymentCapabilitiesService";
import {Clock} from "../../application/port/Clock";
import {IdGenerator} from "../../application/port/IdGenerator";
import {RequestSetupMiddleware} from "./middleware/RequestSetupMiddleware";
import {Logger} from "../../application/port/Logger";
import {WebhookService} from "../../application/services/WebhookService";

export class HttpServer {
    private readonly fastify: FastifyInstance;
    private readonly requestSetupMiddleware: RequestSetupMiddleware;
    private readonly paymentsController: PaymentsController;
    private readonly healthController: HealthController;
    private readonly fetchPaymentCapabilitiesController: FetchPaymentCapabilitiesController;
    private readonly webhookController: WebhookController;

    constructor(
        payinService: PayinService,
        payoutService: PayoutService,
        fetchTransactionStatusService: FetchTransactionStatusService,
        listTransactionsByUserService: ListTransactionsByUserService,
        fetchPaymentCapabilitiesService: FetchPaymentCapabilitiesService,
        webhookService: WebhookService,
        clock: Clock,
        idGenerator: IdGenerator,
        logger: Logger
    ) {
        this.fastify = Fastify({
            logger: true,
        });

        this.fastify.addContentTypeParser(
            "application/octet-stream",
            {parseAs: "buffer"},
            (_request, body, done) => {
                done(null, body);
            }
        );

        this.requestSetupMiddleware = new RequestSetupMiddleware(
            clock,
            idGenerator
        );
        this.paymentsController = new PaymentsController(
            payinService,
            payoutService,
            fetchTransactionStatusService,
            listTransactionsByUserService,
            clock,
            logger
        );
        this.healthController = new HealthController();
        this.webhookController = new WebhookController(
            webhookService,
            logger,
            clock
        );
        this.fetchPaymentCapabilitiesController =
            new FetchPaymentCapabilitiesController(fetchPaymentCapabilitiesService);

        this.setupOpenApi();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupOpenApi(): void {
        this.fastify.register(swagger, {
            openapi: {
                info: {
                    title: "Payments Orchestrator API",
                    version: "1.0.0",
                },
            },
        });

        this.fastify.register(swaggerUi, {
            routePrefix: "/docs",
        });
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

        this.fastify.get(
            "/v1/payment-method-capabilities",
            {
                schema: this.getFetchPaymentCapabilitiesSchema(),
            },
            this.fetchPaymentCapabilitiesController.fetchPaymentCapabilities.bind(
                this.fetchPaymentCapabilitiesController
            )
        );

        // Raw request body is required for webhook signature verification.
        // Do NOT parse body before passing to WebhookController.
        this.fastify.post(
            "/webhooks/razorpay",
            {
                onRequest: async (request) => {
                    request.headers["content-type"] = "application/octet-stream";
                }
            },
            (request, reply) => {
                const requestWithGateway = Object.assign(request, {
                    params: {gatewayId: "RAZORPAY"}
                });
                return this.webhookController.handleWebhook(
                    requestWithGateway as typeof request & {
                        params: {gatewayId: string};
                    },
                    reply
                );
            }
        );
    }

    private getFetchPaymentCapabilitiesSchema(): Record<string, unknown> {
        return {
            description: "Fetch available payment method types and existing payment methods",
            tags: ["payment-methods"],
            querystring: {
                type: "object",
                additionalProperties: false,
                properties: {
                    paymentFlow: {
                        type: "string",
                        enum: ["PAYIN", "PAYOUT"],
                    },
                    status: {
                        type: "string",
                        enum: ["ACTIVE", "INACTIVE"],
                    },
                },
            },
            headers: {
                type: "object",
                required: ["x-user-id"],
                properties: {
                    "x-user-id": { type: "string" },
                },
            },
            response: {
                200: {
                    type: "object",
                    required: ["availablePaymentMethodTypes", "existingPaymentMethods"],
                    properties: {
                        availablePaymentMethodTypes: {
                            type: "array",
                            items: {
                                type: "object",
                                required: [
                                    "methodTypeId",
                                    "displayName",
                                    "status",
                                    "supportedPaymentFlows",
                                    "executionMode",
                                    "identityRequirement",
                                    "allowedIdentifierTypes",
                                    "inputRequirements",
                                    "metadata",
                                ],
                                properties: {
                                    methodTypeId: { type: "string" },
                                    displayName: { type: "string" },
                                    icon: { type: "string" },
                                    status: {
                                        type: "string",
                                        enum: ["ACTIVE", "INACTIVE"],
                                    },
                                    supportedPaymentFlows: {
                                        type: "array",
                                        items: {
                                            type: "string",
                                            enum: ["PAYIN", "PAYOUT", "REFUND"],
                                        },
                                    },
                                    executionMode: {
                                        type: "string",
                                        enum: ["SDK_DRIVEN", "BACKEND_DRIVEN"],
                                    },
                                    identityRequirement: {
                                        type: "string",
                                        enum: ["NONE", "OPTIONAL", "REQUIRED"],
                                    },
                                    identityDefinition: {
                                        type: "object",
                                        required: ["type"],
                                        properties: {
                                            type: {
                                                type: "string",
                                                enum: ["DEFAULT", "CUSTOM"],
                                            },
                                            identifierTypes: {
                                                type: "array",
                                                items: {
                                                    type: "string",
                                                    enum: [
                                                        "UPI_VPA",
                                                        "BANK_ACCOUNT",
                                                        "IFSC",
                                                        "EMAIL",
                                                        "MOBILE",
                                                        "CARD_INSTRUMENT",
                                                    ],
                                                },
                                            },
                                        },
                                    },
                                    allowedIdentifierTypes: {
                                        type: "array",
                                        items: {
                                            type: "string",
                                            enum: [
                                                "UPI_VPA",
                                                "BANK_ACCOUNT",
                                                "IFSC",
                                                "EMAIL",
                                                "MOBILE",
                                                "CARD_INSTRUMENT",
                                            ],
                                        },
                                    },
                                    inputRequirements: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["scope", "fields"],
                                            properties: {
                                                scope: {
                                                    type: "string",
                                                    enum: [
                                                        "PAYMENT_METHOD",
                                                        "CUSTOMER",
                                                        "TRANSACTION",
                                                    ],
                                                },
                                                fields: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        required: [
                                                            "fieldKey",
                                                            "dataType",
                                                            "required",
                                                            "constraints",
                                                        ],
                                                        properties: {
                                                            fieldKey: { type: "string" },
                                                            dataType: { type: "string" },
                                                            required: { type: "boolean" },
                                                            constraints: { type: "object" },
                                                            maskStrategy: { type: "string" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    metadata: { type: "object" },
                                },
                            },
                        },
                        existingPaymentMethods: {
                            type: "array",
                            items: {
                                type: "object",
                                required: [
                                    "paymentMethodId",
                                    "methodTypeId",
                                    "status",
                                    "reusable",
                                    "maskedIdentifiers",
                                ],
                                properties: {
                                    paymentMethodId: { type: "string" },
                                    methodTypeId: { type: "string" },
                                    variant: { type: "string" },
                                    status: {
                                        type: "string",
                                        enum: ["ACTIVE", "INACTIVE", "INVALID"],
                                    },
                                    reusable: { type: "boolean" },
                                    maskedIdentifiers: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["identifierType", "maskedValue"],
                                            properties: {
                                                identifierType: {
                                                    type: "string",
                                                    enum: [
                                                        "UPI_VPA",
                                                        "BANK_ACCOUNT",
                                                        "IFSC",
                                                        "EMAIL",
                                                        "MOBILE",
                                                        "CARD_INSTRUMENT",
                                                    ],
                                                },
                                                maskedValue: { type: "string" },
                                            },
                                        },
                                    },
                                    lastUsedAt: {
                                        type: "string",
                                        format: "date-time",
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    type: "object",
                    required: ["error", "code"],
                    properties: {
                        error: { type: "string" },
                        code: { type: "string" },
                    },
                },
                401: {
                    type: "object",
                    required: ["error", "code"],
                    properties: {
                        error: { type: "string" },
                        code: { type: "string" },
                    },
                },
                500: {
                    type: "object",
                    required: ["error", "code"],
                    properties: {
                        error: { type: "string" },
                        code: { type: "string" },
                    },
                },
            },
        };
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

