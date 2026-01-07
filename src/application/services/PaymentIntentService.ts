import {PaymentIntentRepository} from "../port/PaymentIntentRepository";
import {IdempotencyStore} from "../port/IdempotencyStore";
import {OperationType, PaymentFlow, PaymentIntent} from "../../domain/payment_intent/PaymentIntent";
import {IdGenerator} from "../port/IdGenerator";
import {Clock} from "../port/Clock";
import {Logger} from "../port/Logger";

export interface CreatePaymentIntentParams {
    transactionId: string;
    paymentFlow: PaymentFlow;
    operationType: OperationType;
    amount: number;
    currency: string;
    paymentMethodId: string;
    userId: string;
    payeeReference?: string;
    additionalAttributes?: Record<string, any>;
}

export interface GetOrCreatePaymentIntentResult {
    paymentIntent: PaymentIntent;
    wasCreated: boolean;
}

export class PaymentIntentService {
    private PAYMENT_INTENT_TTL_MS: number;
    constructor(
        private readonly paymentIntentRepository: PaymentIntentRepository,
        private readonly idempotencyStore: IdempotencyStore,
        private readonly idGenerator: IdGenerator,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {
        this.PAYMENT_INTENT_TTL_MS = 5 * 1000; // initialise with 5 seconds
    }

    async getPaymentIntentByTransactionId(
        transactionId: string
    ): Promise<PaymentIntent | null> {
        return await this.paymentIntentRepository.findByTransactionId(transactionId);
    }

    async getOrCreatePaymentIntent(
        params: CreatePaymentIntentParams
    ): Promise<GetOrCreatePaymentIntentResult> {

        // Step 1: Try to acquire idempotency key
        const acquired = await this.idempotencyStore.tryAcquire(
            params.transactionId,
            this.PAYMENT_INTENT_TTL_MS
        );

        // Step 2: If key was not acquired, check repository again to handle race condition
        if (!acquired) {
            throw new Error(
                `Idempotency key already acquired for transactionId: ${params.transactionId}`
            );
        }

        // Step 3: Check if PaymentIntent already exists
        const existingIntent =
            await this.paymentIntentRepository.findByTransactionId(
                params.transactionId
            );

        if (existingIntent) {
            this.logger.error(
                "PaymentIntent already exists for transactionId",
                undefined,
                {
                    transactionId: params.transactionId,
                    paymentIntentId: existingIntent.paymentIntentId
                }
            );
            return {
                paymentIntent: existingIntent,
                wasCreated: false,
            };
        }

        // Step 4: Create new PaymentIntent
        const paymentIntentId = this.idGenerator.generate();
        const now = this.clock.now();

        const paymentIntent = new PaymentIntent(
            paymentIntentId,
            params.paymentFlow,
            params.operationType,
            params.amount,
            params.currency,
            "CREATED",
            now,
            now,
            params.transactionId,
            params.paymentMethodId,
            undefined,
            undefined,
            params.userId,
            params.payeeReference,
            undefined,
            undefined,
            params.additionalAttributes
        );

        await this.paymentIntentRepository.create(paymentIntent);

        this.logger.error(
            "Created new PaymentIntent",
            undefined,
            {
                paymentIntentId,
                transactionId: params.transactionId,
                paymentFlow: params.paymentFlow
            }
        );

        return {
            paymentIntent,
            wasCreated: true,
        };
    }

    async updateGatewaySelection(
        paymentIntent: PaymentIntent,
        gateway: string
    ): Promise<PaymentIntent> {
        const intentWithGateway = paymentIntent.withGateway(gateway);
        const intentWithGatewaySelected = intentWithGateway.withState(
            "GATEWAY_SELECTED"
        );

        await this.paymentIntentRepository.update(intentWithGatewaySelected);

        this.logger.error(
            "Updated PaymentIntent with gateway selection",
            undefined,
            {
                paymentIntentId: paymentIntent.paymentIntentId,
                transactionId: paymentIntent.transactionId,
                gateway
            }
        );

        return intentWithGatewaySelected;
    }

    async updateGatewayInitiation(
        paymentIntent: PaymentIntent,
        gatewayTransactionReference: string
    ): Promise<PaymentIntent> {
        const intentWithGatewayReference =
            paymentIntent.withGatewayTransactionReference(gatewayTransactionReference);
        const intentWithGatewayInitiated =
            intentWithGatewayReference.withState("GATEWAY_INITIATED");

        await this.paymentIntentRepository.update(intentWithGatewayInitiated);

        this.logger.error(
            "Updated PaymentIntent with gateway initiation",
            undefined,
            {
                paymentIntentId: paymentIntent.paymentIntentId,
                transactionId: paymentIntent.transactionId,
                gatewayTransactionReference
            }
        );

        return intentWithGatewayInitiated;
    }
}

