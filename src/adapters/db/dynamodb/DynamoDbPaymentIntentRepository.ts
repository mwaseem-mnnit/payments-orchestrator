import {
    ConditionalCheckFailedException,
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {marshall, unmarshall} from "@aws-sdk/util-dynamodb";
import {PaymentIntent} from "../../../domain/payment_intent/PaymentIntent";
import {PaymentIntentRepository, TransactionQuery,} from "../../../application/port/PaymentIntentRepository";
import {PaginatedResult} from "../../../application/shared/pagination/PaginatedResult";
import {Logger} from "../../../application/port/Logger";
import {Clock} from "../../../application/port/Clock";

interface PaymentIntentDataModel {
    transaction_id: string;
    payment_intent_id: string;
    payment_flow_type: string;
    operation_type: string;
    amount: number;
    currency: string;
    state: string;
    created_at: string;
    updated_at: string;
    payment_method_id: string;
    gateway?: string;
    gateway_transaction_reference?: string;
    payer_reference?: string;
    payee_reference?: string;
    failure_category?: string;
    failure_reason?: string;
    additional_attributes?: Record<string, any>;
    user_identifier?: string; // GSI partition key
}

export class DynamoDbPaymentIntentRepository
    implements PaymentIntentRepository
{
    constructor(
        private readonly dynamoDbClient: DynamoDBClient,
        private readonly tableName: string,
        private readonly gsiName: string,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {}

    async findByTransactionId(
        transactionId: string
    ): Promise<PaymentIntent | null> {
        const command = new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({
                transaction_id: transactionId,
            }),
            ConsistentRead: true,
        });

        try {
            const response = await this.dynamoDbClient.send(command);

            if (!response.Item) {
                return null;
            }

            const dataModel = unmarshall(response.Item) as PaymentIntentDataModel;
            return this.toDomain(dataModel);
        } catch (error) {
            this.logger.error(
                "Failed to find payment intent by transaction ID in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    transactionId,
                    tableName: this.tableName,
                    component: "DynamoDbPaymentIntentRepository",
                }
            );
            throw error;
        }
    }

    async findByUserIdentifier(
        query: TransactionQuery
    ): Promise<PaginatedResult<PaymentIntent>> {
        // Note: GSI queries are eventually consistent by default.
        // This is acceptable for user-based queries per requirements.

        // Query the GSI where user_identifier equals the target userIdentifier.
        // The GSI stores user_identifier as payer_reference (preferred) or
        // payee_reference. We then filter results to include items where
        // the user appears as either payer or payee to ensure completeness.

        const keyConditionExpression = "user_identifier = :userIdentifier";
        const expressionAttributeValues: Record<string, any> = {
            ":userIdentifier": query.userIdentifier,
        };

        // Build filter expression for query-level filters
        const filterExpressions: string[] = [];

        // Filter to ensure user appears as payer or payee
        filterExpressions.push(
            "(payer_reference = :userIdentifier OR payee_reference = :userIdentifier)"
        );

        if (query.paymentFlowType) {
            filterExpressions.push("payment_flow_type = :paymentFlowType");
            expressionAttributeValues[":paymentFlowType"] =
                query.paymentFlowType;
        }

        if (query.status) {
            filterExpressions.push("#state = :state");
            expressionAttributeValues[":state"] = query.status;
        }

        if (query.operationType) {
            filterExpressions.push("operation_type = :operationType");
            expressionAttributeValues[":operationType"] = query.operationType;
        }

        if (query.paymentMethod) {
            filterExpressions.push("payment_method = :paymentMethod");
            expressionAttributeValues[":paymentMethod"] = query.paymentMethod;
        }

        // Handle pagination token
        let exclusiveStartKey: Record<string, any> | undefined = undefined;
        if (query.pageToken) {
            try {
                const tokenBuffer = Buffer.from(query.pageToken, "base64");
                exclusiveStartKey = JSON.parse(tokenBuffer.toString("utf-8"));
            } catch {
                // Invalid token, start from beginning
                exclusiveStartKey = undefined;
            }
        }

        const command = new QueryCommand({
            TableName: this.tableName,
            IndexName: this.gsiName,
            KeyConditionExpression: keyConditionExpression,
            FilterExpression: filterExpressions.join(" AND "),
            ExpressionAttributeValues: marshall(expressionAttributeValues),
            ExpressionAttributeNames: {
                "#state": "state",
            },
            Limit: query.pageSize * 3, // Fetch more to account for filtering
            ExclusiveStartKey: exclusiveStartKey
                ? marshall(exclusiveStartKey)
                : undefined,
        });

        let response;
        try {
            response = await this.dynamoDbClient.send(command);
        } catch (error) {
            this.logger.error(
                "Failed to query payment intents by user identifier in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    userIdentifier: query.userIdentifier,
                    tableName: this.tableName,
                    gsiName: this.gsiName,
                    component: "DynamoDbPaymentIntentRepository",
                }
            );
            throw error;
        }

        let items: PaymentIntent[] = [];
        if (response.Items) {
            for (const item of response.Items) {
                const dataModel = unmarshall(item) as PaymentIntentDataModel;
                items.push(this.toDomain(dataModel));
            }
        }

        // Apply filters that cannot be efficiently expressed in DynamoDB
        items = this.applyPostQueryFilters(items, query);

        // Sort
        items = this.applySorting(items, query);

        // Apply pagination
        const pageSize = query.pageSize;
        let decodedOffset: number | undefined = undefined;

        // If we have a page token but it's not a DynamoDB LastEvaluatedKey,
        // it might be an offset-based token from a previous filtered result
        if (query.pageToken && !exclusiveStartKey) {
            try {
                const tokenBuffer = Buffer.from(query.pageToken, "base64");
                const tokenData = JSON.parse(tokenBuffer.toString("utf-8"));
                decodedOffset = tokenData.offset;
            } catch {
                decodedOffset = undefined;
            }
        }

        const startIndex = decodedOffset || 0;
        const endIndex = startIndex + pageSize;
        const paginatedItems = items.slice(startIndex, endIndex);

        // Generate next page token
        let nextPageToken: string | undefined = undefined;
        if (endIndex < items.length) {
            // Use offset-based token for filtered/sorted results
            const tokenData = { offset: endIndex };
            const tokenBuffer = Buffer.from(JSON.stringify(tokenData), "utf-8");
            nextPageToken = tokenBuffer.toString("base64");
        } else if (response.LastEvaluatedKey) {
            // If DynamoDB has more items, use its token
            const lastKey = unmarshall(
                response.LastEvaluatedKey
            ) as Record<string, any>;
            const tokenBuffer = Buffer.from(JSON.stringify(lastKey), "utf-8");
            nextPageToken = tokenBuffer.toString("base64");
        }

        return {
            items: paginatedItems,
            pageSize,
            pageToken: query.pageToken,
            nextPageToken,
        };
    }

    private applyPostQueryFilters(
        items: PaymentIntent[],
        query: TransactionQuery
    ): PaymentIntent[] {
        return items.filter((intent) => {
            if (query.minAmount !== undefined && intent.amount < query.minAmount) {
                return false;
            }

            if (query.maxAmount !== undefined && intent.amount > query.maxAmount) {
                return false;
            }

            if (query.fromDate) {
                if (intent.createdAt < query.fromDate) {
                    return false;
                }
            }

            if (query.toDate) {
                if (intent.createdAt > query.toDate) {
                    return false;
                }
            }

            return true;
        });
    }

    private applySorting(
        items: PaymentIntent[],
        query: TransactionQuery
    ): PaymentIntent[] {
        const sortBy = query.sortBy || "createdAt";
        const sortOrder = query.sortOrder || "DESC";

        const sorted = [...items];

        sorted.sort((a, b) => {
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

        return sorted;
    }

    async create(paymentIntent: PaymentIntent): Promise<void> {
        const dataModel = this.toDataModel(paymentIntent);

        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(dataModel),
            ConditionExpression: "attribute_not_exists(transaction_id)",
        });

        try {
            await this.dynamoDbClient.send(command);
        } catch (error) {
            if (error instanceof ConditionalCheckFailedException) {
                // Expected condition - item already exists
                throw new Error(
                    `Payment intent with transaction_id ${paymentIntent.transactionId} already exists`
                );
            }
            // Unexpected DynamoDB failure - log it
            this.logger.error(
                "Failed to create payment intent in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    transactionId: paymentIntent.transactionId,
                    tableName: this.tableName,
                    component: "DynamoDbPaymentIntentRepository",
                }
            );
            throw error;
        }
    }

    async update(paymentIntent: PaymentIntent): Promise<void> {
        const dataModel = this.toDataModel(paymentIntent);

        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(dataModel),
        });

        try {
            await this.dynamoDbClient.send(command);
        } catch (error) {
            this.logger.error(
                "Failed to update payment intent in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    transactionId: paymentIntent.transactionId,
                    tableName: this.tableName,
                    component: "DynamoDbPaymentIntentRepository",
                }
            );
            throw error;
        }
    }

    private toDataModel(paymentIntent: PaymentIntent): PaymentIntentDataModel {
        // Determine user_identifier for GSI partition key.
        // We store payerReference (preferred) or payeeReference if payer not available.
        // Note: This means queries will find items where the user is stored in the GSI,
        // and FilterExpression ensures the user appears as payer or payee.
        // To support queries where user can be either payer or payee comprehensively,
        // consider storing duplicate GSI items or using a different GSI design pattern.
        const userIdentifier =
            paymentIntent.payerReference || paymentIntent.payeeReference || "";

        const dataModel: PaymentIntentDataModel = {
            transaction_id: paymentIntent.transactionId,
            payment_intent_id: paymentIntent.paymentIntentId,
            payment_flow_type: paymentIntent.paymentFlowType,
            operation_type: paymentIntent.operationType,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            state: paymentIntent.state,
            created_at: paymentIntent.createdAt.toISOString(),
            updated_at: paymentIntent.updatedAt.toISOString(),
            payment_method_id: paymentIntent.paymentMethodId,
            user_identifier: userIdentifier,
        };

        if (paymentIntent.gateway) {
            dataModel.gateway = paymentIntent.gateway;
        }

        if (paymentIntent.gatewayTransactionReference) {
            dataModel.gateway_transaction_reference =
                paymentIntent.gatewayTransactionReference;
        }

        if (paymentIntent.payerReference) {
            dataModel.payer_reference = paymentIntent.payerReference;
        }

        if (paymentIntent.payeeReference) {
            dataModel.payee_reference = paymentIntent.payeeReference;
        }

        if (paymentIntent.failureCategory) {
            dataModel.failure_category = paymentIntent.failureCategory;
        }

        if (paymentIntent.failureReason) {
            dataModel.failure_reason = paymentIntent.failureReason;
        }

        if (paymentIntent.additionalAttributes) {
            dataModel.additional_attributes =
                paymentIntent.additionalAttributes;
        }

        return dataModel;
    }

    private toDomain(dataModel: PaymentIntentDataModel): PaymentIntent {
        return new PaymentIntent(
            dataModel.payment_intent_id,
            dataModel.payment_flow_type as "PAYIN" | "PAYOUT",
            dataModel.operation_type as
                | "CHARGE"
                | "AUTHORIZE"
                | "CAPTURE"
                | "VOID"
                | "PAYOUT",
            dataModel.amount,
            dataModel.currency,
            dataModel.state as any,
            this.clock.fromIsoString(dataModel.created_at),
            this.clock.fromIsoString(dataModel.updated_at),
            dataModel.transaction_id,
            dataModel.payment_method_id,
            dataModel.gateway,
            dataModel.gateway_transaction_reference,
            dataModel.payer_reference,
            dataModel.payee_reference,
            dataModel.failure_category as any,
            dataModel.failure_reason,
            dataModel.additional_attributes
        );
    }
}

