import { PaymentIntent } from "../../domain/payment_intent/PaymentIntent";
import { CanonicalEvent } from "../../domain/events/CanonicalEvent";
import { CreatePaymentIntentResult } from "../results/CreatePaymentIntentResult";
import {
    GatewayRoutingPort,
    GatewayRoutingRequest,
    GatewayRoutingErrorType
} from "../port/GatewayRoutingPort";
import { PaymentGatewayPort, CreatePayinRequest, GatewayOperationContext } from "../port/PaymentGatewayPort";
import { EventPublisher } from "../port/EventPublisher";
import { Clock } from "../port/Clock";
import { IdGenerator } from "../port/IdGenerator";
import { Logger } from "../port/Logger";
import { PaymentMethodService } from "./PaymentMethodService";
import { PaymentIntentService } from "./PaymentIntentService";
import { CreatePayinCommand } from "../commands/PaymentCommand";
import { GatewayHealthStatus } from "../../domain/routing/GatewayHealthStatus";

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
        const now = this.clock.now();

        // Step 1: Validate Request
        this.validateRequest(command);

        // Step 2: Resolve PaymentMethod
        const paymentMethod = await this.paymentMethodService.resolvePaymentMethod({
            paymentMethodId: command.paymentMethodId,
            paymentMethodInput: command.paymentMethodInput,
            userIdentifier: command.userIdentifier,
            paymentFlow: "PAYIN"
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
            }
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
            // Build routing request
            const routingRequest = new GatewayRoutingRequest(
                "PAYIN",
                "CHARGE",
                command.amount,
                currency,
                paymentMethod.paymentMethodId,
                paymentMethod.methodTypeId,
                process.env.region,
                command.userIdentifier,
                undefined,
                command.additionalAttributes
            );

            // Get eligible gateways (in production, this would come from a gateway eligibility service)
            // For now, using a placeholder - in real implementation this should be injected
            const eligibleGateways = this.getEligibleGateways(paymentMethod.methodTypeId, currency);

            // Get gateway health status (in production, this would come from a health service)
            // For now, defaulting all to HEALTHY - in real implementation this should be injected
            const gatewayHealth = this.getGatewayHealth(eligibleGateways);

            // Select gateway using routing
            const routingResult = await this.gatewayRoutingPort.selectGateway(
                routingRequest,
                eligibleGateways,
                gatewayHealth
            );

            if (!routingResult.isSuccess() || !routingResult.selectedGatewayId) {
                const errorMessage = routingResult.error?.message || "Gateway routing failed";
                this.logger.error(
                    "Gateway routing failed",
                    undefined,
                    {
                        paymentIntentId,
                        transactionId: command.transactionId,
                        errorType: routingResult.error?.errorType,
                        errorDetails: routingResult.error?.details
                    }
                );
                throw new Error(`Gateway selection failed: ${errorMessage}`);
            }

            selectedGateway = routingResult.selectedGatewayId;
        }

        // Step 5: Update PaymentIntent with Gateway Selection
        const intentWithGatewaySelected = await this.paymentIntentService.updateGatewaySelection(
            paymentIntent,
            selectedGateway
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
            gatewayOrderResponse.gatewayTransactionReference
        );

        this.logger.error(
            "PaymentIntent created successfully",
            undefined,
            {
                paymentIntentId,
                transactionId: command.transactionId,
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

    /**
     * Gets eligible gateways for the payment method type and currency.
     * 
     * TODO: This should be replaced with a proper GatewayEligibilityService
     * that determines eligible gateways based on payment method, currency, region, etc.
     */
    private getEligibleGateways(
        paymentMethodType?: string,
        currency?: string
    ): string[] {
        // Placeholder implementation - returns common gateways
        // In production, this should query gateway capabilities
        return ["RAZORPAY", "CASHFREE", "JUSPAY"];
    }

    /**
     * Gets gateway health status for the given gateways.
     * 
     * TODO: This should be replaced with a proper GatewayHealthService
     * that queries real-time or cached gateway health status.
     */
    private getGatewayHealth(gateways: string[]): Map<string, GatewayHealthStatus> {
        const healthMap = new Map<string, GatewayHealthStatus>();
        // Default all gateways to HEALTHY for now
        // In production, this should query actual health status
        for (const gateway of gateways) {
            healthMap.set(gateway, "HEALTHY");
        }
        return healthMap;
    }
}

