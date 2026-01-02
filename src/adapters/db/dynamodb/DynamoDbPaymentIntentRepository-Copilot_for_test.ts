import {
    DynamoDBClient,
    PutItemCommand,
    GetItemCommand,
    QueryCommand,
    UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
    PaymentIntentRepository,
    TransactionQuery,
    PaginatedResult,
} from "../../../application/port/PaymentIntentRepository";
import { PaymentIntent } from "../../../domain/payment_intent/PaymentIntent";

/**
 * DynamoDB adapter for PaymentIntentRepository.
 *
 * Table Structure:
 * - PK: transaction_id (String) - Primary Key
 * - GSI1: user_identifier (String) - Global Secondary Index for user queries
 * - GSI1_SK: created_at (String) - Sort key for GSI1 (ISO 8601 format)
 *
 * Constraints:
 * - Must implement PaymentIntentRepository
 * - Class-based implementation only
 * - No business logic
 * - snake_case allowed ONLY in DynamoDB attribute names
 * - camelCase everywhere else
 * - Follow authority/structural_coding_rules.md
 */
export class DynamoDbPaymentIntentRepositoryCopilot_for_test implements PaymentIntentRepository {
    constructor(
        private readonly dynamoDbClient: DynamoDBClient,
        private readonly tableName: string
    ) {}

    async findByTransactionId(transactionId: string): Promise<PaymentIntent | null> {
        const command = new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({
                transaction_id: transactionId,
            }),
        });

        const response = await this.dynamoDbClient.send(command);

        if (!response.Item) {
            return null;
        }

        const item = unmarshall(response.Item);
        return this.toDomain(item);
    }

    async findByUserIdentifier(query: TransactionQuery): Promise<PaginatedResult<PaymentIntent>> {
        const keyConditionExpression = "user_identifier = :userIdentifier";
        const expressionAttributeValues: Record<string, any> = {
            ":userIdentifier": query.userIdentifier,
        };
        const filterExpressions: string[] = [];

        // Build filter expressions for optional query parameters
        if (query.paymentFlowType) {
            filterExpressions.push("payment_flow_type = :paymentFlowType");
            expressionAttributeValues[":paymentFlowType"] = query.paymentFlowType;
        }

        if (query.status) {
            filterExpressions.push("#state = :status");
            expressionAttributeValues[":status"] = query.status;
        }

        if (query.operationType) {
            filterExpressions.push("operation_type = :operationType");
            expressionAttributeValues[":operationType"] = query.operationType;
        }

        if (query.paymentMethod) {
            filterExpressions.push("payment_method = :paymentMethod");
            expressionAttributeValues[":paymentMethod"] = query.paymentMethod;
        }

        if (query.minAmount !== undefined) {
            filterExpressions.push("amount >= :minAmount");
            expressionAttributeValues[":minAmount"] = query.minAmount;
        }

        if (query.maxAmount !== undefined) {
            filterExpressions.push("amount <= :maxAmount");
            expressionAttributeValues[":maxAmount"] = query.maxAmount;
        }

        if (query.fromDate) {
            filterExpressions.push("created_at >= :fromDate");
            expressionAttributeValues[":fromDate"] = query.fromDate.toISOString();
        }

        if (query.toDate) {
            filterExpressions.push("created_at <= :toDate");
            expressionAttributeValues[":toDate"] = query.toDate.toISOString();
        }

        const command = new QueryCommand({
            TableName: this.tableName,
            IndexName: "GSI1",
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeNames: query.status ? { "#state": "state" } : undefined,
            ExpressionAttributeValues: marshall(expressionAttributeValues),
            FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(" AND ") : undefined,
            ScanIndexForward: query.sortOrder === "ASC",
            Limit: query.pageSize,
            ExclusiveStartKey: query.pageToken ? JSON.parse(Buffer.from(query.pageToken, "base64").toString()) : undefined,
        });

        const response = await this.dynamoDbClient.send(command);

        const items = (response.Items || []).map((item) => {
            const unmarshalled = unmarshall(item);
            return this.toDomain(unmarshalled);
        });

        const nextPageToken = response.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString("base64")
            : undefined;

        return {
            items,
            pageSize: query.pageSize,
            pageToken: query.pageToken,
            nextPageToken,
        };
    }

    async create(paymentIntent: PaymentIntent): Promise<void> {
        const item = this.toDataModel(paymentIntent);

        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(item),
        });

        await this.dynamoDbClient.send(command);
    }

    async update(paymentIntent: PaymentIntent): Promise<void> {
        const item = this.toDataModel(paymentIntent);

        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(item),
        });

        await this.dynamoDbClient.send(command);
    }

    private toDataModel(paymentIntent: PaymentIntent): Record<string, any> {
        // Determine user_identifier for GSI1
        const userIdentifier = paymentIntent.payerReference || paymentIntent.payeeReference || "";

        return {
            transaction_id: paymentIntent.transactionId,
            payment_intent_id: paymentIntent.paymentIntentId,
            payment_flow_type: paymentIntent.paymentFlowType,
            operation_type: paymentIntent.operationType,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            state: paymentIntent.state,
            created_at: paymentIntent.createdAt.toISOString(),
            updated_at: paymentIntent.updatedAt.toISOString(),
            payment_method: paymentIntent.paymentMethod,
            gateway: paymentIntent.gateway,
            gateway_transaction_reference: paymentIntent.gatewayTransactionReference,
            payer_reference: paymentIntent.payerReference,
            payee_reference: paymentIntent.payeeReference,
            failure_category: paymentIntent.failureCategory,
            failure_reason: paymentIntent.failureReason,
            additional_attributes: paymentIntent.additionalAttributes,
            user_identifier: userIdentifier, // GSI1 partition key
        };
    }

    private toDomain(item: Record<string, any>): PaymentIntent {
        return new PaymentIntent(
            item.payment_intent_id,
            item.payment_flow_type,
            item.operation_type,
            item.amount,
            item.currency,
            item.state,
            new Date(item.created_at),
            new Date(item.updated_at),
            item.transaction_id,
            item.payment_method,
            item.gateway,
            item.gateway_transaction_reference,
            item.payer_reference,
            item.payee_reference,
            item.failure_category,
            item.failure_reason,
            item.additional_attributes
        );
    }
}
