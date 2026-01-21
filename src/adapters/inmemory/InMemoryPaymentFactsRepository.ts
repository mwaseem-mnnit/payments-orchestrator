import {PaymentFactsRepository} from "../../application/port/PaymentFactsRepository";
import {PaymentFact} from "../../domain/payment_fact/PaymentFact";

export class InMemoryPaymentFactsRepository implements PaymentFactsRepository {
    private readonly factsById = new Map<string, PaymentFact>();
    private readonly factsByTransactionId = new Map<string, PaymentFact[]>();
    private readonly factsByIdempotencyKey = new Map<string, PaymentFact>();

    async findByFactId(factId: string): Promise<PaymentFact | null> {
        return this.factsById.get(factId) ?? null;
    }

    async create(fact: PaymentFact): Promise<{ created: boolean }> {
        const idempotencyKey = this.buildIdempotencyKey(fact);
        if (this.factsByIdempotencyKey.has(idempotencyKey)) {
            return {created: false};
        }

        this.factsById.set(fact.factId, fact);
        this.factsByIdempotencyKey.set(idempotencyKey, fact);

        const existing = this.factsByTransactionId.get(fact.transactionId) ?? [];
        existing.push(fact);
        this.factsByTransactionId.set(fact.transactionId, existing);

        return {created: true};
    }

    async findByTransactionId(
        transactionId: string
    ): Promise<ReadonlyArray<PaymentFact>> {
        const facts = this.factsByTransactionId.get(transactionId) ?? [];
        return [...facts].sort(
            (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
        );
    }

    async findByIdempotencyKey(
        idempotencyKey: string
    ): Promise<PaymentFact | null> {
        return this.factsByIdempotencyKey.get(idempotencyKey) ?? null;
    }

    async updateProcessingOutcome(
        factId: string,
        processingOutcome: "NEW" | "PROCESSED" | "IGNORED" | "ORPHANED"
    ): Promise<boolean> {
        const fact = this.factsById.get(factId);
        if (!fact) {
            return false;
        }

        if (fact.processingOutcome !== "NEW") {
            return false;
        }

        const updatedFact = new PaymentFact(
            fact.factId,
            fact.transactionId,
            fact.paymentFlow,
            fact.source,
            fact.sourceReference,
            fact.gatewayId,
            fact.gatewayTransactionReference,
            fact.canonicalStatus,
            fact.occurredAt,
            fact.receivedAt,
            fact.metadata,
            processingOutcome
        );

        this.factsById.set(factId, updatedFact);
        const idempotencyKey = this.buildIdempotencyKey(updatedFact);
        this.factsByIdempotencyKey.set(idempotencyKey, updatedFact);

        const byTransaction = this.factsByTransactionId.get(
            updatedFact.transactionId
        );
        if (byTransaction) {
            const index = byTransaction.findIndex(
                (item) => item.factId === updatedFact.factId
            );
            if (index >= 0) {
                byTransaction[index] = updatedFact;
            }
        }

        return true;
    }

    private buildIdempotencyKey(fact: PaymentFact): string {
        const occurredAtValue = fact.occurredAt
            ? fact.occurredAt.getTime().toString()
            : "";
        const sourceReference = fact.sourceReference ?? "";

        return [
            fact.transactionId,
            fact.source,
            sourceReference,
            fact.canonicalStatus,
            occurredAtValue
        ].join("|");
    }
}
