import {PaymentIntent} from "../../domain/payment_intent/PaymentIntent";
import {ListTransactionsByUserCommand} from "../commands/ListTransactionsByUserCommand";
import {ListTransactionsByUserResult} from "../results/ListTransactionsByUserResult";
import {FetchTransactionStatusResult} from "../results/FetchTransactionStatusResult";
import {PaymentIntentRepository, TransactionQuery,} from "../port/PaymentIntentRepository";

export class ListTransactionsByUserService {
    constructor(
        private readonly paymentIntentRepository: PaymentIntentRepository
    ) {}

    async execute(
        command: ListTransactionsByUserCommand
    ): Promise<ListTransactionsByUserResult> {
        // Step 1: Validate Request
        this.validateRequest(command);

        // Step 2: Query Transactions
        const query = this.buildQuery(command);
        const paginatedResult =
            await this.paymentIntentRepository.findByUserIdentifier(query);

        // Step 3: Assemble Transaction Responses
        // Reuse the same assembly logic as Journey 03
        const transactions = paginatedResult.items.map((paymentIntent) =>
            this.assembleTransactionResponse(paymentIntent)
        );

        // Step 4: Construct Paginated Response
        const result = new ListTransactionsByUserResult(
            transactions,
            paginatedResult.pageSize,
            paginatedResult.pageToken,
            paginatedResult.nextPageToken
        );

        // Step 5: Return Response
        return result;
    }

    private validateRequest(command: ListTransactionsByUserCommand): void {
        if (!command.userIdentifier || command.userIdentifier.trim() === "") {
            throw new Error("userIdentifier is mandatory");
        }

        if (command.pageSize !== undefined) {
            if (command.pageSize <= 0) {
                throw new Error("pageSize must be positive");
            }
            if (command.pageSize > 100) {
                throw new Error("pageSize must not exceed 100");
            }
        }

        if (command.minAmount !== undefined && command.maxAmount !== undefined) {
            if (command.minAmount > command.maxAmount) {
                throw new Error("minAmount must not exceed maxAmount");
            }
        }

        if (command.fromDate && command.toDate) {
            if (command.fromDate > command.toDate) {
                throw new Error("fromDate must not exceed toDate");
            }
        }

        if (command.sortBy && !["createdAt", "amount", "updatedAt"].includes(command.sortBy)) {
            throw new Error("sortBy must be one of: createdAt, amount, updatedAt");
        }

        if (command.sortOrder && !["ASC", "DESC"].includes(command.sortOrder)) {
            throw new Error("sortOrder must be ASC or DESC");
        }
    }

    private buildQuery(
        command: ListTransactionsByUserCommand
    ): TransactionQuery {
        return {
            userIdentifier: command.userIdentifier,
            paymentFlowType: command.paymentFlowType,
            status: command.status,
            operationType: command.operationType,
            paymentMethod: command.paymentMethod,
            minAmount: command.minAmount,
            maxAmount: command.maxAmount,
            fromDate: command.fromDate,
            toDate: command.toDate,
            sortBy: command.sortBy || "createdAt",
            sortOrder: command.sortOrder || "DESC",
            pageSize: command.pageSize || 20,
            pageToken: command.pageToken,
        };
    }

    private assembleTransactionResponse(
        paymentIntent: PaymentIntent
    ): FetchTransactionStatusResult {
        // Reuse the exact same logic as Journey 03: Fetch Transaction Status
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

