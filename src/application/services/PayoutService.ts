import {PaymentIntent} from "../../domain/payment_intent/PaymentIntent";
import {PaymentMethod} from "../../domain/payment_method/PaymentMethod";
import {CanonicalEvent} from "../../domain/events/CanonicalEvent";
import {PaymentCommand} from "../commands/PaymentCommand";
import {MakePayoutResult} from "../results/MakePayoutResult";
import {GatewayRoutingPort, GatewayRoutingRequest} from "../port/GatewayRoutingPort";
import {CreatePayoutRequest, CreatePayoutResponse, GatewayOperationContext} from "../port/PaymentGatewayPort";
import {EventPublisher} from "../port/EventPublisher";
import {Clock} from "../port/Clock";
import {IdGenerator} from "../port/IdGenerator";
import {Logger} from "../port/Logger";
import {PaymentMethodService} from "./PaymentMethodService";
import {PaymentIntentService} from "./PaymentIntentService";
import {GatewayHealthStatus} from "../../domain/routing/GatewayHealthStatus";
import {
    PaymentMethodGatewayMappingService
} from "../../domain/payment_method_gateway_mapping/PaymentMethodGatewayMappingService";
import {GatewayAdapterRegistry} from "../port/GatewayAdapterRegistry";
import {ValidationError} from "../../errors/ValidationError";

export class PayoutService {
    constructor(
        private readonly paymentMethodService: PaymentMethodService,
        private readonly paymentIntentService: PaymentIntentService,
        private readonly paymentMethodGatewayMappingService: PaymentMethodGatewayMappingService,
        private readonly gatewayRoutingPort: GatewayRoutingPort,
        private readonly gatewayAdapterRegistry: GatewayAdapterRegistry,
        private readonly eventPublisher: EventPublisher,
        private readonly clock: Clock,
        private readonly idGenerator: IdGenerator,
        private readonly logger: Logger
    ) {
        if (!paymentMethodGatewayMappingService) {
            throw new Error("PaymentMethodGatewayMappingService must be provided");
        }
    }

    async execute(command: PaymentCommand): Promise<MakePayoutResult> {
        const now = this.clock.now();

        // Step 1: Validate Request
        await this.validateRequest(command);

        // Step 2: Resolve PaymentMethod
        const paymentMethod = await this.paymentMethodService.resolvePaymentMethod({
            paymentMethodId: command.paymentMethodId,
            paymentMethodInput: command.paymentMethodInput,
            userIdentifier: command.userIdentifier,
            paymentFlow: "PAYOUT"
        });

        // Step 3: Get or Create PaymentIntent (MUST occur before any gateway call, idempotency handled internally)
        const currency = command.currency || "INR";
        const beneficiaryIdentifier = this.extractBeneficiaryIdentifier(
            paymentMethod
        );
        const getOrCreateResult = await this.paymentIntentService.getOrCreatePaymentIntent(
            {
                transactionId: command.transactionId,
                paymentFlow: "PAYOUT",
                operationType: "PAYOUT",
                amount: command.amount,
                currency: currency,
                paymentMethodId: paymentMethod.paymentMethodId,
                userId: command.userIdentifier,
                payeeReference: beneficiaryIdentifier,
                additionalAttributes: command.additionalAttributes,
            }
        );

        // If PaymentIntent already existed, return it immediately
        if (!getOrCreateResult.wasCreated) {
            return await this.assembleResponse(getOrCreateResult.paymentIntent);
        }

        const paymentIntent = getOrCreateResult.paymentIntent;
        const paymentIntentId = paymentIntent.paymentIntentId;

        // Step 4: Resolve eligible gateways (mapping service)
        const eligibleGateways = await this.resolveEligibleGateways(
            paymentMethod,
            currency,
            command.amount,
            command.additionalAttributes
        );

        // Step 5: Select gateway (routing)
        const selectedGateway = await this.selectGatewayForPayout(
            command,
            paymentMethod,
            paymentIntent,
            currency,
            beneficiaryIdentifier,
            eligibleGateways
        );

        // Step 6: Update PaymentIntent with Gateway Selection
        const intentWithGatewaySelected = await this.paymentIntentService.updateGatewaySelection(
            paymentIntent,
            selectedGateway
        );

        // Step 7: Execute gateway payout
        const gatewayOrderResponse = await this.executeGatewayPayout(
            intentWithGatewaySelected,
            paymentMethod,
            command.gatewayContext
        );

        // Step 8: Update PaymentIntent with Gateway Reference
        const intentWithGatewayInitiated = await this.paymentIntentService.updateGatewayInitiation(
            intentWithGatewaySelected,
            gatewayOrderResponse.gatewayTransactionReference
        );

        // Step 9: Emit events
        await this.emitPayoutEvents(
            paymentIntentId,
            command.transactionId,
            selectedGateway,
            gatewayOrderResponse.gatewayTransactionReference,
            now
        );

        this.logger.error(
            "PaymentIntent created successfully",
            undefined,
            {
                paymentIntentId,
                transactionId: command.transactionId,
                gateway: selectedGateway
            }
        );

        // Step 10: Assemble and Return Response
        return await this.assembleResponse(intentWithGatewayInitiated);
    }

    private async validateRequest(command: PaymentCommand): Promise<void> {
        if (!command.transactionId || command.transactionId.trim() === "") {
            throw new Error("transactionId is mandatory");
        }

        if (command.amount === undefined || command.amount === null) {
            throw new Error("amount is mandatory");
        }

        if (command.amount <= 0) {
            throw new Error("amount must be positive");
        }

        if (!command.userIdentifier || command.userIdentifier.trim() === "") {
            throw new Error("userIdentifier is mandatory");
        }

        // Validate PaymentMethod fields
        await this.paymentMethodService.validatePaymentMethodFields(
            {
                paymentMethodId: command.paymentMethodId,
                paymentMethodInput: command.paymentMethodInput,
                userIdentifier: command.userIdentifier
            },
            "PAYOUT"
        );
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
            "PAYOUT",
            "PAYOUT",
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
            "PAYOUT",
            "PAYOUT",
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

    private extractBeneficiaryIdentifier(
        paymentMethod: PaymentMethod
    ): string | undefined {
        if (paymentMethod.identifiers.length === 0) {
            return undefined;
        }

        // Extract identifier from the first identifier's value
        const firstIdentifier = paymentMethod.identifiers[0];
        return firstIdentifier.identifierValue;
    }

    private async assembleResponse(
        paymentIntent: PaymentIntent
    ): Promise<MakePayoutResult> {
        const paymentMethod = await this.paymentMethodService.getPaymentMethodById(
            paymentIntent.paymentMethodId
        );

        return new MakePayoutResult(
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
     * Resolves eligible gateways using PaymentMethodGatewayMappingService.
     * 
     * Returns a list of gateway IDs that are eligible for the given payment context.
     * All returned gateways are treated as HEALTHY for now.
     */
    private async resolveEligibleGateways(
        paymentMethod: PaymentMethod,
        currency: string,
        amount: number,
        additionalAttributes?: Record<string, unknown>
    ): Promise<string[]> {
        const region = process.env.region || "IN";
        
        const eligibleGatewaysSet = await this.paymentMethodGatewayMappingService.resolveEligibleGateways({
            paymentFlow: "PAYOUT",
            methodTypeId: paymentMethod.methodTypeId,
            variant: paymentMethod.variant,
            amount: amount,
            currency: currency,
            region: region,
            customAttributes: additionalAttributes
        });

        // Convert Set to array of gateway IDs
        const eligibleGateways: string[] = [];
        for (const eligibleGateway of eligibleGatewaysSet) {
            eligibleGateways.push(eligibleGateway.gatewayId);
        }

        if (eligibleGateways.length === 0) {
            this.logger.error(
                "No eligible gateways found for payment method",
                undefined,
                {
                    methodTypeId: paymentMethod.methodTypeId,
                    currency: currency,
                    region: region
                }
            );
            throw new Error(
                `No eligible gateways found for payment method type ${paymentMethod.methodTypeId} in region ${region}`
            );
        }

        return eligibleGateways;
    }

    /**
     * Selects a single gateway using the routing domain.
     * 
     * Handles both preferred gateway (if provided) and routing-based selection.
     * Fails explicitly if no gateway can be selected.
     */
    private async selectGatewayForPayout(
        command: PaymentCommand,
        paymentMethod: PaymentMethod,
        paymentIntent: PaymentIntent,
        currency: string,
        beneficiaryIdentifier: string | undefined,
        eligibleGateways: string[]
    ): Promise<string> {
        // If preferred gateway is provided, use it (must still be eligible)
        if (command.preferredGateway) {
            if (!eligibleGateways.includes(command.preferredGateway)) {
                this.logger.error(
                    "Preferred gateway is not eligible",
                    undefined,
                    {
                        preferredGateway: command.preferredGateway,
                        eligibleGateways: eligibleGateways,
                        paymentIntentId: paymentIntent.paymentIntentId
                    }
                );
                throw new Error(
                    `Preferred gateway ${command.preferredGateway} is not eligible for this payment context`
                );
            }
            return command.preferredGateway;
        }

        // Build routing request
        const routingRequest = new GatewayRoutingRequest(
            "PAYOUT",
            "PAYOUT",
            command.amount,
            currency,
            paymentMethod.paymentMethodId,
            paymentMethod.methodTypeId,
            process.env.region,
            command.userIdentifier,
            beneficiaryIdentifier,
            command.additionalAttributes
        );

        // Get gateway health status (all treated as HEALTHY for now)
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
                    paymentIntentId: paymentIntent.paymentIntentId,
                    transactionId: command.transactionId,
                    errorType: routingResult.error?.errorType,
                    errorDetails: routingResult.error?.details
                }
            );
            throw new Error(`Gateway selection failed: ${errorMessage}`);
        }

        return routingResult.selectedGatewayId;
    }

    /**
     * Gets gateway health status for the given gateways.
     * 
     * For now, all gateways are treated as HEALTHY.
     * TODO: Replace with proper GatewayHealthService implementation.
     */
    private getGatewayHealth(gateways: string[]): Map<string, GatewayHealthStatus> {
        const healthMap = new Map<string, GatewayHealthStatus>();
        for (const gateway of gateways) {
            healthMap.set(gateway, "HEALTHY");
        }
        return healthMap;
    }

    /**
     * Executes gateway payout operation.
     * 
     * Calls the gateway adapter and returns the canonical response.
     * Does not mutate PaymentIntent state.
     */
    private async executeGatewayPayout(
        paymentIntent: PaymentIntent,
        paymentMethod: PaymentMethod,
        gatewayContext?: Record<string, unknown>
    ): Promise<CreatePayoutResponse> {
        const context = gatewayContext ? new GatewayOperationContext(gatewayContext) : undefined;
        const gatewayId = paymentIntent.gateway;
        if (!gatewayId) {
            throw new ValidationError("PaymentIntent.gateway is required");
        }

        const adapter = this.gatewayAdapterRegistry.getGatewayAdapter(gatewayId);
        if (!adapter) {
            throw new ValidationError(
                `No gateway adapter registered for gatewayId ${gatewayId}`
            );
        }

        const createPayoutRequest = new CreatePayoutRequest(
            paymentIntent,
            paymentMethod,
            context
        );

        return await adapter.createPayout(createPayoutRequest);
    }

    /**
     * Emits canonical events for payout execution.
     * 
     * Events are emitted asynchronously and do not affect control flow.
     * Failures in event emission are logged but do not fail the request.
     */
    private async emitPayoutEvents(
        paymentIntentId: string,
        transactionId: string,
        selectedGateway: string,
        gatewayTransactionReference: string,
        timestamp: Date
    ): Promise<void> {
        try {
            const intentCreatedEvent = this.createIntentCreatedEvent(
                paymentIntentId,
                transactionId,
                timestamp
            );
            await this.eventPublisher.publish(intentCreatedEvent);

            const gatewayInitiatedEvent = this.createGatewayInitiatedEvent(
                paymentIntentId,
                transactionId,
                selectedGateway,
                gatewayTransactionReference,
                timestamp
            );
            await this.eventPublisher.publish(gatewayInitiatedEvent);
        } catch (error) {
            // Event emission failures should not fail the request
            this.logger.error(
                "Failed to emit payout events",
                error instanceof Error ? error : undefined,
                {
                    paymentIntentId,
                    transactionId,
                    selectedGateway
                }
            );
        }
    }
}

