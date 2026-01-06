import { PaymentIntent } from "../../domain/payment_intent/PaymentIntent";
import { CanonicalEvent } from "../../domain/events/CanonicalEvent";
import { CreatePaymentIntentResult } from "../results/CreatePaymentIntentResult";
import { GatewayRoutingPort } from "../port/GatewayRoutingPort";
import { PaymentGatewayPort, CreatePayinRequest, GatewayOperationContext } from "../port/PaymentGatewayPort";
import { EventPublisher } from "../port/EventPublisher";
import { Clock } from "../port/Clock";
import { IdGenerator } from "../port/IdGenerator";
import { Logger } from "../port/Logger";
import { PaymentMethodService } from "./PaymentMethodService";
import { PaymentIntentService } from "./PaymentIntentService";
import {CreatePayinCommand} from "../commands/PaymentCommand";

export class PayinService {
    constructor(
        private readonly paymentMethodService: PaymentMethodService,
        private readonly paymentIntentService: PaymentIntentService,
        private readonly gatewayRoutingPort: GatewayRoutingPort,
        private readonly paymentGatewayPort: PaymentGatewayPort,
        private readonly eventPublisher: EventPublisher,
        private readonly clock: Clock,
        private readonly idGenerator: IdGenerator,
        private readonly logger: Logger
    ) {}

    async execute(
        command: CreatePayinCommand
    ): Promise<CreatePaymentIntentResult> {
        const correlationId = this.idGenerator.generate();
        const now = this.clock.now();

        // Step 1: Validate Request
        this.validateRequest(command);

        // Step 2: Resolve PaymentMethod
        const paymentMethod = await this.paymentMethodService.resolvePaymentMethod({
            paymentMethodId: command.paymentMethodId,
            paymentMethodInput: command.paymentMethodInput,
            userIdentifier: command.userIdentifier,
            paymentFlow: "PAYIN",
            correlationId,
        });

        // Step 3: Get or Create PaymentIntent (MUST occur before any gateway call, idempotency handled internally)
        const currency = command.currency || "INR";
        const getOrCreateResult = await this.paymentIntentService.getOrCreatePaymentIntent(
            {
                transactionId: command.transactionId,
                paymentFlow: "PAYIN",
                operationType: "CHARGE",
                amount: command.amount,
                currency: currency,
                paymentMethodId: paymentMethod.paymentMethodId,
                userId: command.userIdentifier,
                payeeReference: undefined,
                additionalAttributes: command.additionalAttributes,
            },
            correlationId
        );

        // If PaymentIntent already existed, return it immediately
        if (!getOrCreateResult.wasCreated) {
            return await this.assembleResponse(getOrCreateResult.paymentIntent);
        }

        const paymentIntent = getOrCreateResult.paymentIntent;
        const paymentIntentId = paymentIntent.paymentIntentId;

        // Step 4: Resolve Payment Gateway (Routing)
        let selectedGateway: string;
        if (command.preferredGateway) {
            selectedGateway = command.preferredGateway;
        } else {
            selectedGateway = await this.gatewayRoutingPort.resolveGateway({
                paymentMethod: paymentMethod,
                amount: command.amount,
                currency: currency,
            });
        }

        // Step 5: Update PaymentIntent with Gateway Selection
        const intentWithGatewaySelected = await this.paymentIntentService.updateGatewaySelection(
            paymentIntent,
            selectedGateway,
            correlationId
        );

        // Step 6: Initiate Gateway Order
        const context = new GatewayOperationContext(command.gatewayContext);

        const createPayinRequest = new CreatePayinRequest(
            intentWithGatewaySelected,
            paymentMethod,
            context
        );

        const gatewayOrderResponse =
            await this.paymentGatewayPort.createPayin(
                selectedGateway,
                createPayinRequest
            );

        // Step 7: Emit Canonical Events
        const intentCreatedEvent = this.createIntentCreatedEvent(
            paymentIntentId,
            command.transactionId,
            now
        );
        await this.eventPublisher.publish(intentCreatedEvent);

        const gatewayInitiatedEvent = this.createGatewayInitiatedEvent(
            paymentIntentId,
            command.transactionId,
            selectedGateway,
            gatewayOrderResponse.gatewayTransactionReference,
            now
        );
        await this.eventPublisher.publish(gatewayInitiatedEvent);

        // Step 8: Update PaymentIntent with Gateway Reference
        const intentWithGatewayInitiated = await this.paymentIntentService.updateGatewayInitiation(
            intentWithGatewaySelected,
            gatewayOrderResponse.gatewayTransactionReference,
            correlationId
        );

        this.logger.error(
            "PaymentIntent created successfully",
            undefined,
            {
                paymentIntentId,
                transactionId: command.transactionId,
                correlationId,
                gateway: selectedGateway,
            }
        );

        // Step 9: Assemble and Return Response
        return this.assembleResponse(intentWithGatewayInitiated);
    }

    private validateRequest(command: CreatePayinCommand): void {
        if (!command.transactionId || command.transactionId.trim() === "") {
            throw new Error("transactionId is mandatory");
        }

        if (command.amount === undefined || command.amount === null) {
            throw new Error("amount is mandatory");
        }

        if (command.amount < 0) {
            throw new Error("amount must be non-negative");
        }

        if (!command.userIdentifier || command.userIdentifier.trim() === "") {
            throw new Error("userIdentifier is mandatory");
        }

        // Validate PaymentMethod fields
        this.paymentMethodService.validatePaymentMethodFields({
            paymentMethodId: command.paymentMethodId,
            paymentMethodInput: command.paymentMethodInput,
        });
    }


    private createIntentCreatedEvent(
        paymentIntentId: string,
        transactionId: string,
        timestamp: Date
    ): CanonicalEvent {
        return new CanonicalEvent(
            this.idGenerator.generate(),
            "intent_created",
            paymentIntentId,
            "SYSTEM",
            timestamp,
            timestamp,
            "PAYIN",
            "CHARGE",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            transactionId
        );
    }

    private createGatewayInitiatedEvent(
        paymentIntentId: string,
        transactionId: string,
        gateway: string,
        gatewayTransactionReference: string,
        timestamp: Date
    ): CanonicalEvent {
        return new CanonicalEvent(
            this.idGenerator.generate(),
            "gateway_initiated",
            paymentIntentId,
            "SYSTEM",
            timestamp,
            timestamp,
            "PAYIN",
            "CHARGE",
            gateway,
            gatewayTransactionReference,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            transactionId
        );
    }

    private async assembleResponse(
        paymentIntent: PaymentIntent
    ): Promise<CreatePaymentIntentResult> {
        const paymentMethod = await this.paymentMethodService.getPaymentMethodById(
            paymentIntent.paymentMethodId
        );

        return new CreatePaymentIntentResult(
            paymentIntent.transactionId,
            paymentIntent.paymentIntentId,
            paymentMethod,
            paymentIntent.state,
            paymentIntent.amount,
            paymentIntent.currency,
            paymentIntent.createdAt,
            paymentIntent.updatedAt,
            paymentIntent.gateway
        );
    }
}

