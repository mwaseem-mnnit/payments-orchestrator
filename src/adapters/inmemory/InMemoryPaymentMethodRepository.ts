import {PaymentMethod} from "../../domain/payment_method/PaymentMethod";
import {PaymentFlow} from "../../domain/payment_intent/PaymentIntent";
import {PaymentMethodQuery, PaymentMethodRepository,} from "../../application/port/PaymentMethodRepository";
import {PaginatedResult} from "../../application/shared/pagination/PaginatedResult";
import {IdentifierType} from "../../domain/payment_method_type/PaymentMethodType";
import {Clock} from "../../application/port/Clock";
import {SystemClock} from "../system/SystemClock";

export class InMemoryPaymentMethodRepository implements PaymentMethodRepository {
    private readonly byId: Map<string, PaymentMethod> = new Map();
    private readonly byUserAndFlow: Map<string, PaymentMethod[]> = new Map();
    private readonly byIdentifier: Map<string, Array<{paymentMethodId: string; createdAt: number}>> = new Map();
    private readonly byIdentityKey: Map<string, PaymentMethod> = new Map();
    private identifierSequence = 1;

    constructor(private readonly clock: Clock = new SystemClock()) {}

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
            const entries = this.byIdentifier.get(identifierKey) || [];
            const baseCreatedAt = this.clock.toEpochMillis(this.clock.now());
            const createdAt = baseCreatedAt + this.identifierSequence;
            entries.push({
                paymentMethodId: paymentMethod.paymentMethodId,
                createdAt,
            });
            this.identifierSequence += 1;
            this.byIdentifier.set(identifierKey, entries);
        }

        if (paymentMethod.identityKey) {
            this.byIdentityKey.set(paymentMethod.identityKey, paymentMethod);
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
        normalizedValue: string,
        query: PaymentMethodQuery
    ): Promise<PaginatedResult<PaymentMethod>> {
        const key = `${identifierType}:${normalizedValue}`;
        const entries = (this.byIdentifier.get(key) || []).slice();
        entries.sort((a, b) => b.createdAt - a.createdAt);

        let startIndex = 0;
        if (query.pageToken) {
            const tokenStart = this.resolveIdentifierPageToken(
                key,
                query.pageToken,
                entries
            );
            if (tokenStart !== undefined) {
                startIndex = tokenStart;
            }
        }

        const endIndex = startIndex + query.pageSize;
        const pageEntries = entries.slice(startIndex, endIndex);
        const items = pageEntries
            .map((entry) => this.byId.get(entry.paymentMethodId))
            .filter((paymentMethod): paymentMethod is PaymentMethod =>
                Boolean(paymentMethod)
            );

        let nextPageToken: string | undefined;
        if (endIndex < entries.length && pageEntries.length > 0) {
            const lastEntry = pageEntries[pageEntries.length - 1];
            const tokenData = {
                identifier_type_normalized_value: key,
                created_at: lastEntry.createdAt,
            };
            const tokenBuffer = Buffer.from(
                JSON.stringify(tokenData),
                "utf-8"
            );
            nextPageToken = tokenBuffer.toString("base64");
        }

        return {
            items,
            pageSize: query.pageSize,
            pageToken: query.pageToken,
            nextPageToken,
        };
    }

    async findByIdentityKey(identityKey: string): Promise<PaymentMethod | null> {
        return this.byIdentityKey.get(identityKey) || null;
    }

    private resolveIdentifierPageToken(
        key: string,
        pageToken: string,
        entries: Array<{paymentMethodId: string; createdAt: number}>
    ): number | undefined {
        try {
            const tokenBuffer = Buffer.from(pageToken, "base64");
            const tokenData = JSON.parse(tokenBuffer.toString("utf-8")) as {
                identifier_type_normalized_value?: string;
                created_at?: number;
            };
            if (tokenData.identifier_type_normalized_value !== key) {
                return undefined;
            }
            const lastCreatedAt = tokenData.created_at;
            if (typeof lastCreatedAt !== "number") {
                return undefined;
            }
            const nextIndex = entries.findIndex(
                (entry) => entry.createdAt < lastCreatedAt
            );
            return nextIndex === -1 ? entries.length : nextIndex;
        } catch {
            return undefined;
        }
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
            existing.identityKey,
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
        this.byIdentityKey.clear();
    }
}

