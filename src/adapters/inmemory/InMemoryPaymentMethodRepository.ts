import {IdentifierType, PaymentMethod} from "../../domain/payment_method/PaymentMethod";
import {PaymentFlow} from "../../domain/payment_intent/PaymentIntent";
import {PaymentMethodQuery, PaymentMethodRepository,} from "../../application/port/PaymentMethodRepository";
import {PaginatedResult} from "../../application/shared/pagination/PaginatedResult";

export class InMemoryPaymentMethodRepository implements PaymentMethodRepository {
    private readonly byId: Map<string, PaymentMethod> = new Map();
    private readonly byUserAndFlow: Map<string, PaymentMethod[]> = new Map();
    private readonly byIdentifier: Map<string, PaymentMethod> = new Map();

    async save(paymentMethod: PaymentMethod): Promise<void> {
        this.byId.set(paymentMethod.paymentMethodId, paymentMethod);

        const userFlowKey = `${paymentMethod.userIdentifier}:${paymentMethod.paymentFlow}`;
        const userFlowList = this.byUserAndFlow.get(userFlowKey) || [];
        const existingIndex = userFlowList.findIndex(
            (pm) => pm.paymentMethodId === paymentMethod.paymentMethodId
        );
        if (existingIndex >= 0) {
            userFlowList[existingIndex] = paymentMethod;
        } else {
            userFlowList.push(paymentMethod);
        }
        this.byUserAndFlow.set(userFlowKey, userFlowList);

        for (const identifier of paymentMethod.identifiers) {
            const identifierKey = `${identifier.identifierType}:${identifier.normalizedValue}`;
            this.byIdentifier.set(identifierKey, paymentMethod);
        }
    }

    async findById(paymentMethodId: string): Promise<PaymentMethod | null> {
        return this.byId.get(paymentMethodId) || null;
    }

    async findByUserAndFlow(
        userId: string,
        paymentFlow: PaymentFlow
    ): Promise<PaymentMethod[]> {
        const key = `${userId}:${paymentFlow}`;
        return this.byUserAndFlow.get(key) || [];
    }

    async findByIdentifier(
        identifierType: IdentifierType,
        normalizedValue: string
    ): Promise<PaymentMethod | null> {
        const key = `${identifierType}:${normalizedValue}`;
        return this.byIdentifier.get(key) || null;
    }

    async listByUser(
        userId: string,
        query: PaymentMethodQuery
    ): Promise<PaginatedResult<PaymentMethod>> {
        let allMethods: PaymentMethod[] = [];

        if (query.paymentFlow) {
            allMethods = await this.findByUserAndFlow(userId, query.paymentFlow);
        } else {
            const flows: PaymentFlow[] = ["PAYIN", "PAYOUT", "REFUND"];
            for (const flow of flows) {
                const methods = await this.findByUserAndFlow(userId, flow);
                allMethods.push(...methods);
            }
        }

        let filtered = allMethods.filter((method) => {
            if (query.status && method.status !== query.status) {
                return false;
            }
            return !(query.reusable !== undefined && method.reusable !== query.reusable);

        });

        if (query.sortBy) {
            filtered.sort((a, b) => {
                let comparison = 0;
                if (query.sortBy === "lastUsedAt") {
                    const aTime = a.lastUsedAt?.getTime() || 0;
                    const bTime = b.lastUsedAt?.getTime() || 0;
                    comparison = bTime - aTime;
                } else if (query.sortBy === "usageCount") {
                    comparison = b.usageCount - a.usageCount;
                }
                return query.sortOrder === "ASC" ? -comparison : comparison;
            });
        }

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

        const startIndex = offset;
        const endIndex = startIndex + pageSize;
        const items = filtered.slice(startIndex, endIndex);

        let nextPageToken: string | undefined;
        if (endIndex < filtered.length) {
            nextPageToken = endIndex.toString();
        }

        return {
            items,
            pageSize,
            pageToken: query.pageToken,
            nextPageToken,
        };
    }

    async incrementUsage(paymentMethodId: string, timestamp: Date): Promise<void> {
        const existing = this.byId.get(paymentMethodId);
        if (!existing) {
            return;
        }

        const updated = new PaymentMethod(
            existing.paymentMethodId,
            existing.userIdentifier,
            existing.paymentFlow,
            existing.methodTypeId,
            existing.variant,
            existing.status,
            existing.reusable,
            existing.usageCount + 1,
            timestamp,
            existing.identifiers
        );

        await this.save(updated);
    }

    clear(): void {
        this.byId.clear();
        this.byUserAndFlow.clear();
        this.byIdentifier.clear();
    }
}

