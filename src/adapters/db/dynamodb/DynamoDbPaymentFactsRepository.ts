import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
    UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import {marshall, unmarshall} from "@aws-sdk/util-dynamodb";
import {PaymentFact} from "../../../domain/payment_fact/PaymentFact";
import {PaymentFactsRepository} from "../../../application/port/PaymentFactsRepository";
import {Clock} from "../../../application/port/Clock";
import {Logger} from "../../../application/port/Logger";

interface PaymentFactDataModel {
    fact_id: string;
    transaction_id: string;
    payment_flow: string;
    source: string;
    source_reference?: string;
    gateway_id?: string;
    gateway_transaction_reference?: string;
    canonical_status: string;
    occurred_at?: number;
    received_at: number;
    metadata: Record<string, unknown>;
    processing_outcome: string;
    idempotency_key: string;
    transaction_id_gsi: string;
    gateway_transaction_reference_gsi?: string;
    idempotency_key_gsi: string;
    received_at_gsi: number;
}

export class DynamoDbPaymentFactsRepository implements PaymentFactsRepository {
    constructor(
        private readonly dynamoDbClient: DynamoDBClient,
        private readonly tableName: string,
        private readonly gsi1Name: string,
        private readonly gsi2Name: string,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {}

    async findByFactId(factId: string): Promise<PaymentFact | null> {
        const command = new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({
                fact_id: factId
            }),
            ConsistentRead: true
        });

        const response = await this.dynamoDbClient.send(command);

        if (!response.Item) {
            return null;
        }

        const dataModel = unmarshall(response.Item) as PaymentFactDataModel;
        return this.toDomain(dataModel);
    }

    async create(
        fact: PaymentFact
    ): Promise<{ created: boolean }> {
        const computedIdempotencyKey = this.buildIdempotencyKey(fact);
        const existingFact = await this.findByIdempotencyKey(computedIdempotencyKey);

        if (existingFact) {
            return {created: false};
        }

        const dataModel = this.toDataModel(fact, computedIdempotencyKey);
        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(dataModel, {removeUndefinedValues: true}),
            ConditionExpression: "attribute_not_exists(fact_id)"
        });

        await this.dynamoDbClient.send(command);

        return {created: true};
    }

    async findByTransactionId(
        transactionId: string
    ): Promise<ReadonlyArray<PaymentFact>> {
        const command = new QueryCommand({
            TableName: this.tableName,
            IndexName: this.gsi1Name,
            KeyConditionExpression: "transaction_id = :transactionId",
            ExpressionAttributeValues: marshall({
                ":transactionId": transactionId
            }),
            ConsistentRead: true,
            ScanIndexForward: true
        });

        const response = await this.dynamoDbClient.send(command);

        if (!response.Items || response.Items.length === 0) {
            return [];
        }

        return response.Items.map((item) => {
            const dataModel = unmarshall(item) as PaymentFactDataModel;
            return this.toDomain(dataModel);
        });
    }

    async updateProcessingOutcome(
        factId: string,
        processingOutcome: "NEW" | "PROCESSED" | "IGNORED" | "ORPHANED"
    ): Promise<boolean> {
        const command = new UpdateItemCommand({
            TableName: this.tableName,
            Key: marshall({
                fact_id: factId
            }),
            UpdateExpression: "SET processing_outcome = :processingOutcome",
            ConditionExpression: "processing_outcome = :expectedOutcome",
            ExpressionAttributeValues: marshall({
                ":processingOutcome": processingOutcome,
                ":expectedOutcome": "NEW"
            })
        });

        await this.dynamoDbClient.send(command);
        return true;
    }

    async findByIdempotencyKey(
        idempotencyKey: string
    ): Promise<PaymentFact | null> {
        const command = new QueryCommand({
            TableName: this.tableName,
            IndexName: this.gsi2Name,
            KeyConditionExpression: "idempotency_key = :idempotencyKey",
            ExpressionAttributeValues: marshall({
                ":idempotencyKey": idempotencyKey
            }),
            ConsistentRead: true,
            Limit: 1
        });

        const response = await this.dynamoDbClient.send(command);

        if (!response.Items || response.Items.length === 0) {
            return null;
        }

        const dataModel = unmarshall(response.Items[0]) as PaymentFactDataModel;
        return this.toDomain(dataModel);
    }

    private buildIdempotencyKey(fact: PaymentFact): string {
        const occurredAt = fact.occurredAt ? fact.occurredAt.toISOString() : "";
        const sourceReference = fact.sourceReference ?? "";
        return [
            fact.transactionId,
            fact.source,
            sourceReference,
            fact.canonicalStatus,
            occurredAt
        ].join("|");
    }

    private toDataModel(
        fact: PaymentFact,
        idempotencyKey: string
    ): PaymentFactDataModel {
        return {
            fact_id: fact.factId,
            transaction_id: fact.transactionId,
            payment_flow: fact.paymentFlow,
            source: fact.source,
            source_reference: fact.sourceReference,
            gateway_id: fact.gatewayId,
            gateway_transaction_reference: fact.gatewayTransactionReference,
            canonical_status: fact.canonicalStatus,
            occurred_at: fact.occurredAt ? fact.occurredAt.getTime() : undefined,
            received_at: fact.receivedAt.getTime(),
            metadata: fact.metadata,
            processing_outcome: fact.processingOutcome,
            idempotency_key: idempotencyKey,
            transaction_id_gsi: fact.transactionId,
            gateway_transaction_reference_gsi: fact.gatewayTransactionReference,
            idempotency_key_gsi: idempotencyKey,
            received_at_gsi: fact.receivedAt.getTime(),
        };
    }

    private toDomain(dataModel: PaymentFactDataModel): PaymentFact {
        return new PaymentFact(
            dataModel.fact_id,
            dataModel.transaction_id,
            dataModel.payment_flow as PaymentFact["paymentFlow"],
            dataModel.source as PaymentFact["source"],
            dataModel.source_reference,
            dataModel.gateway_id,
            dataModel.gateway_transaction_reference,
            dataModel.canonical_status as PaymentFact["canonicalStatus"],
            dataModel.occurred_at ? this.clock.fromEpochMillis(dataModel.occurred_at) : undefined,
            this.clock.fromEpochMillis(dataModel.received_at),
            dataModel.metadata,
            dataModel.processing_outcome as PaymentFact["processingOutcome"]
        );
    }
}
