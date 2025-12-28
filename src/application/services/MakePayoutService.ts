import {PaymentIntent} from "../../domain/payment_intent/PaymentIntent";
import {CanonicalEvent} from "../../domain/events/CanonicalEvent";
import {GatewayOrderRequest} from "../../domain/gateway/GatewayOrderRequest";
import {MakePayoutCommand} from "../commands/MakePayoutCommand";
import {MakePayoutResult} from "../results/MakePayoutResult";
import {PaymentIntentRepository} from "../port/PaymentIntentRepository";
import {IdempotencyStore} from "../port/IdempotencyStore";
import {GatewayRoutingPort} from "../port/GatewayRoutingPort";
import {PaymentGatewayPort} from "../port/PaymentGatewayPort";
import {EventPublisher} from "../port/EventPublisher";
import {Clock} from "../port/Clock";
import {IdGenerator} from "../port/IdGenerator";

export class MakePayoutService {
    constructor(
        private readonly paymentIntentRepository: PaymentIntentRepository,
        private readonly idempotencyStore: IdempotencyStore,
        private readonly gatewayRoutingPort: GatewayRoutingPort,
        private readonly paymentGatewayPort: PaymentGatewayPort,
        private readonly eventPublisher: EventPublisher,
        private readonly clock: Clock,
        private readonly idGenerator: IdGenerator
    ) {}

    async execute(command: MakePayoutCommand): Promise<MakePayoutResult> {
        // Step 1: Validate Request
        this.validateRequest(command);

        // Step 2: Idempotency Check
        // Check repository first (source of truth)
        const existingIntent =
            await this.paymentIntentRepository.findByTransactionId(
                command.transactionId
            );

        if (existingIntent) {
            return this.assembleResponse(existingIntent);
        }

        // Try to acquire idempotency key (24 hour TTL)
        const acquired = await this.idempotencyStore.tryAcquire(
            command.transactionId,
            24 * 60 * 60 * 1000
        );

        // If key was not acquired, check repository again to handle race condition
        // where another process may have created it between the first check and acquisition attempt
        if (!acquired) {
            const raceConditionCheck =
                await this.paymentIntentRepository.findByTransactionId(
                    command.transactionId
                );
            if (raceConditionCheck) {
                return this.assembleResponse(raceConditionCheck);
            }
            // If still not found, another process is currently processing this transaction
            throw new Error(
                `Idempotency key already acquired for transactionId: ${command.transactionId}`
            );
        }

        // Step 3: Create Payout Transaction Record
        const now = this.clock.now();
        const paymentIntentId = this.idGenerator.generate();
        const currency = command.currency || "INR";

        // Store beneficiary details in additionalAttributes
        // payeeReference can hold the beneficiary identifier (e.g., UPI ID, account number)
        const beneficiaryIdentifier = this.extractBeneficiaryIdentifier(
            command.beneficiaryDetails
        );
        const attributesWithBeneficiary = {
            ...command.additionalAttributes,
            beneficiaryDetails: command.beneficiaryDetails,
        };

        const paymentIntent = new PaymentIntent(
            paymentIntentId,
            "PAYOUT",
            "PAYOUT",
            command.amount,
            currency,
            "CREATED",
            now,
            now,
            command.transactionId,
            command.paymentMethod,
            undefined,
            undefined,
            command.userIdentifier,
            beneficiaryIdentifier,
            undefined,
            undefined,
            attributesWithBeneficiary
        );

        await this.paymentIntentRepository.create(paymentIntent);

        // Step 4: Resolve Payment Gateway (Routing)
        let selectedGateway: string;
        if (command.paymentGateway) {
            selectedGateway = command.paymentGateway;
        } else {
            selectedGateway = await this.gatewayRoutingPort.resolveGateway({
                paymentMethod: command.paymentMethod,
                amount: command.amount,
                currency: currency,
            });
        }

        // Transition to GATEWAY_SELECTED state
        const intentWithGateway = paymentIntent.withGateway(selectedGateway);
        const intentWithGatewaySelected = intentWithGateway.withState(
            "GATEWAY_SELECTED"
        );
        await this.paymentIntentRepository.update(intentWithGatewaySelected);

        // Step 5: Initiate Gateway Payout
        const gatewayOrderRequest = new GatewayOrderRequest(
            intentWithGatewaySelected,
            command.customerData,
            command.beneficiaryDetails
        );

        const gatewayOrderResponse =
            await this.paymentGatewayPort.createPayout(
                selectedGateway,
                gatewayOrderRequest
            );

        // Step 6: Emit Canonical Events
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

        // Step 7: Update Transaction with Gateway Reference
        // Transition to GATEWAY_INITIATED state
        const intentWithGatewayReference =
            intentWithGatewaySelected.withGatewayTransactionReference(
                gatewayOrderResponse.gatewayTransactionReference
            );
        const intentWithGatewayInitiated =
            intentWithGatewayReference.withState("GATEWAY_INITIATED");
        await this.paymentIntentRepository.update(intentWithGatewayInitiated);

        // Step 8 & 9: Assemble and Return Response
        return this.assembleResponse(intentWithGatewayInitiated);
    }

    private validateRequest(command: MakePayoutCommand): void {
        if (!command.transactionId || command.transactionId.trim() === "") {
            throw new Error("transactionId is mandatory");
        }

        if (command.amount === undefined || command.amount === null) {
            throw new Error("amount is mandatory");
        }

        if (command.amount <= 0) {
            throw new Error("amount must be positive");
        }

        if (!command.paymentMethod || command.paymentMethod.trim() === "") {
            throw new Error("paymentMethod is mandatory");
        }

        // Validate beneficiary details based on PM type
        if (!command.beneficiaryDetails) {
            throw new Error("beneficiaryDetails are required for payout");
        }

        // Basic validation - beneficiary details should not be empty
        if (
            Object.keys(command.beneficiaryDetails).length === 0
        ) {
            throw new Error("beneficiaryDetails cannot be empty");
        }
    }

    private extractBeneficiaryIdentifier(
        beneficiaryDetails?: Record<string, any>
    ): string | undefined {
        if (!beneficiaryDetails) {
            return undefined;
        }

        // Extract identifier based on common fields
        return (
            beneficiaryDetails.upiId ||
            beneficiaryDetails.accountNumber ||
            beneficiaryDetails.paypalId ||
            beneficiaryDetails.identifier ||
            undefined
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

    private assembleResponse(
        paymentIntent: PaymentIntent
    ): MakePayoutResult {
        return new MakePayoutResult(
            paymentIntent.transactionId,
            paymentIntent.paymentIntentId,
            paymentIntent.paymentMethod,
            paymentIntent.state,
            paymentIntent.amount,
            paymentIntent.currency,
            paymentIntent.createdAt,
            paymentIntent.updatedAt,
            paymentIntent.gateway
        );
    }
}

