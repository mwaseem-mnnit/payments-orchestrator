import { PaymentIntent } from "../../domain/payment_intent/PaymentIntent";
import { FetchTransactionStatusCommand } from "../commands/FetchTransactionStatusCommand";
import { FetchTransactionStatusResult } from "../results/FetchTransactionStatusResult";
import { PaymentIntentRepository } from "../port/PaymentIntentRepository";

export class FetchTransactionStatusService {
    constructor(
        private readonly paymentIntentRepository: PaymentIntentRepository
    ) {}

    async execute(
        command: FetchTransactionStatusCommand
    ): Promise<FetchTransactionStatusResult> {
        // Step 1: Validate Request
        this.validateRequest(command);

        // Step 2: Load Transaction Record
        const paymentIntent =
            await this.paymentIntentRepository.findByTransactionId(
                command.transactionId
            );

        if (!paymentIntent) {
            throw new Error(
                `Transaction not found for transactionId: ${command.transactionId}`
            );
        }

        // Step 3: Assemble Transaction Details
        // Step 4: Attach Stored Gateway Metadata
        const result = this.assembleResponse(paymentIntent);

        // Step 5: Return Response
        return result;
    }

    private validateRequest(command: FetchTransactionStatusCommand): void {
        if (!command.transactionId || command.transactionId.trim() === "") {
            throw new Error("transactionId is mandatory");
        }
    }

    private assembleResponse(
        paymentIntent: PaymentIntent
    ): FetchTransactionStatusResult {
        // Extract gateway metadata from additionalAttributes
        const gatewayMetadata = this.extractGatewayMetadata(
            paymentIntent.additionalAttributes
        );

        return new FetchTransactionStatusResult(
            paymentIntent.transactionId,
            paymentIntent.paymentIntentId,
            paymentIntent.paymentFlowType,
            paymentIntent.paymentMethod,
            paymentIntent.state,
            paymentIntent.amount,
            paymentIntent.currency,
            paymentIntent.createdAt,
            paymentIntent.updatedAt,
            gatewayMetadata,
            paymentIntent.gateway
        );
    }

    private extractGatewayMetadata(
        additionalAttributes?: Record<string, any>
    ): Record<string, any> | undefined {
        if (!additionalAttributes) {
            return undefined;
        }

        // Extract metadata that might be useful for response
        // This includes things like masked UPI ID, bank account last 4 digits, etc.
        // Only return metadata that is already stored (no masking logic here)
        const metadata: Record<string, any> = {};

        // Common gateway metadata fields
        if (additionalAttributes.maskedUpiId) {
            metadata.maskedUpiId = additionalAttributes.maskedUpiId;
        }
        if (additionalAttributes.bankAccountLast4) {
            metadata.bankAccountLast4 = additionalAttributes.bankAccountLast4;
        }
        if (additionalAttributes.ifsc) {
            metadata.ifsc = additionalAttributes.ifsc;
        }
        if (additionalAttributes.cardLast4) {
            metadata.cardLast4 = additionalAttributes.cardLast4;
        }
        if (additionalAttributes.walletPhone) {
            metadata.walletPhone = additionalAttributes.walletPhone;
        }
        if (additionalAttributes.walletEmail) {
            metadata.walletEmail = additionalAttributes.walletEmail;
        }

        // Include beneficiary details if present (for payouts)
        if (additionalAttributes.beneficiaryDetails) {
            metadata.beneficiaryDetails = additionalAttributes.beneficiaryDetails;
        }

        // Return undefined if no metadata found, otherwise return the metadata object
        return Object.keys(metadata).length > 0 ? metadata : undefined;
    }
}

