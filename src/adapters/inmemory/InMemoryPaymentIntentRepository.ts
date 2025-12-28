import {PaymentIntent} from "../../domain/payment_intent/PaymentIntent";
import {
    PaginatedResult,
    PaymentIntentRepository,
    TransactionQuery,
} from "../../application/port/PaymentIntentRepository";

export class InMemoryPaymentIntentRepository
    implements PaymentIntentRepository {
    private readonly byTransactionId: Map<string, PaymentIntent> = new Map();
    private readonly allIntents: PaymentIntent[] = [];

    async findByTransactionId(
        transactionId: string
    ): Promise<PaymentIntent | null> {
        return this.byTransactionId.get(transactionId) || null;
    }

    async findByUserIdentifier(
        query: TransactionQuery
    ): Promise<PaginatedResult<PaymentIntent>> {
        // Filter by userIdentifier (check both payerReference and payeeReference)
        let filtered = this.allIntents.filter((intent) => {
            const userMatch =
                intent.payerReference === query.userIdentifier ||
                intent.payeeReference === query.userIdentifier;
            if (!userMatch) return false;

            // Apply filters
            if (
                query.paymentFlowType &&
                intent.paymentFlowType !== query.paymentFlowType
            ) {
                return false;
            }

            if (query.status && intent.state !== query.status) {
                return false;
            }

            if (
                query.operationType &&
                intent.operationType !== query.operationType
            ) {
                return false;
            }

            if (
                query.paymentMethod &&
                intent.paymentMethod !== query.paymentMethod
            ) {
                return false;
            }

            if (query.minAmount !== undefined && intent.amount < query.minAmount) {
                return false;
            }

            if (query.maxAmount !== undefined && intent.amount > query.maxAmount) {
                return false;
            }

            if (query.fromDate) {
                const compareDate = query.fromDate;
                if (intent.createdAt < compareDate) {
                    return false;
                }
            }

            if (query.toDate) {
                const compareDate = query.toDate;
                if (intent.createdAt > compareDate) {
                    return false;
                }
            }

            return true;
        });

        // Sort
        const sortBy = query.sortBy || "createdAt";
        const sortOrder = query.sortOrder || "DESC";

        filtered.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case "createdAt":
                    comparison =
                        a.createdAt.getTime() - b.createdAt.getTime();
                    break;
                case "amount":
                    comparison = a.amount - b.amount;
                    break;
                case "updatedAt":
                    comparison =
                        a.updatedAt.getTime() - b.updatedAt.getTime();
                    break;
            }

            return sortOrder === "ASC" ? comparison : -comparison;
        });

        // Pagination using pageToken (simple offset-based for in-memory)
        const pageSize = query.pageSize;
        let offset = 0;

        if (query.pageToken) {
            try {
                offset = parseInt(query.pageToken, 10);
                if (isNaN(offset) || offset < 0) {
                    offset = 0;
                }
            } catch {
                offset = 0;
            }
        }

        const totalItems = filtered.length;
        const startIndex = offset;
        const endIndex = startIndex + pageSize;
        const items = filtered.slice(startIndex, endIndex);

        // Generate next page token if there are more items
        let nextPageToken: string | undefined = undefined;
        if (endIndex < totalItems) {
            nextPageToken = endIndex.toString();
        }

        return {
            items,
            pageSize,
            pageToken: query.pageToken,
            nextPageToken,
        };
    }

    async create(paymentIntent: PaymentIntent): Promise<void> {
        // Check if already exists
        if (this.byTransactionId.has(paymentIntent.transactionId)) {
            // Update instead of throwing error (idempotent behavior)
            await this.update(paymentIntent);
            return;
        }

        this.byTransactionId.set(
            paymentIntent.transactionId,
            paymentIntent
        );
        this.allIntents.push(paymentIntent);
    }

    async update(paymentIntent: PaymentIntent): Promise<void> {
        const existing = this.byTransactionId.get(
            paymentIntent.transactionId
        );

        if (!existing) {
            // If not found, create it
            await this.create(paymentIntent);
            return;
        }

        // Update in map
        this.byTransactionId.set(
            paymentIntent.transactionId,
            paymentIntent
        );

        // Update in array
        const index = this.allIntents.findIndex(
            (intent) =>
                intent.transactionId === paymentIntent.transactionId
        );
        if (index !== -1) {
            this.allIntents[index] = paymentIntent;
        }
    }

    clear(): void {
        this.byTransactionId.clear();
        this.allIntents.length = 0;
    }
}

