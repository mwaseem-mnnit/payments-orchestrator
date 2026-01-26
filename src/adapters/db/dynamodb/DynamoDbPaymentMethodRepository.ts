import {
    AttributeValue,
    BatchGetItemCommand,
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
    UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import {marshall, unmarshall} from "@aws-sdk/util-dynamodb";
import {PaymentMethod, PaymentMethodIdentifier} from "../../../domain/payment_method/PaymentMethod";
import {PaymentFlow} from "../../../domain/payment_intent/PaymentIntent";
import {PaymentMethodQuery, PaymentMethodRepository,} from "../../../application/port/PaymentMethodRepository";
import {PaginatedResult} from "../../../application/shared/pagination/PaginatedResult";
import {Logger} from "../../../application/port/Logger";
import {IdentifierType} from "../../../domain/payment_method_type/PaymentMethodType";
import {Clock} from "../../../application/port/Clock";

interface PaymentMethodDataModel {
    payment_method_id: string;
    user_identifier: string;
    payment_flow: string;
    method_type_id: string;
    variant?: string;
    status: string;
    reusable: boolean;
    identity_key?: string;
    usage_count: number;
    last_used_at?: number;
    identifiers: Array<{
        payment_method_id: string;
        identifier_type: string;
        identifier_value: string;
        normalized_value: string;
    }>;
    user_id_gsi?: string; // GSI partition key
    last_used_at_gsi?: number; // GSI sort key
}

interface PaymentMethodIdentifierDataModel {
    identifier_type_normalized_value: string; // PK: identifier_type#normalized_value
    created_at: number; // SK: created_at (epoch millis)
    payment_method_id: string;
    payment_method_id_gsi: string;
}

export class DynamoDbPaymentMethodRepository implements PaymentMethodRepository {
    constructor(
        private readonly dynamoDbClient: DynamoDBClient,
        private readonly tableName: string,
        private readonly userFlowGsiName: string,
        private readonly identifierTableName: string,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {}

    async save(paymentMethod: PaymentMethod): Promise<void> {
        const dataModel = this.toDataModel(paymentMethod);
        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(dataModel),
        });

        try {
            await this.dynamoDbClient.send(command);

            // Save identifiers in separate table for findByIdentifier
            const createdAt = this.clock.toEpochMillis(this.clock.now());
            for (const identifier of paymentMethod.identifiers) {
                const identifierDataModel: PaymentMethodIdentifierDataModel = {
                    identifier_type_normalized_value: `${identifier.identifierType}#${identifier.normalizedValue}`,
                    created_at: createdAt,
                    payment_method_id: paymentMethod.paymentMethodId,
                    payment_method_id_gsi: paymentMethod.paymentMethodId,
                };

                const identifierCommand = new PutItemCommand({
                    TableName: this.identifierTableName,
                    Item: marshall(identifierDataModel),
                });

                await this.dynamoDbClient.send(identifierCommand);
            }

            // Save identityKey mapping if present
            if (paymentMethod.identityKey) {
                const identityKeyCommand = new PutItemCommand({
                    TableName: this.identifierTableName,
                    Item: marshall({
                        identifier_type_normalized_value: `IDENTITY_KEY#${paymentMethod.identityKey}`,
                        created_at: createdAt,
                        payment_method_id: paymentMethod.paymentMethodId,
                        payment_method_id_gsi: paymentMethod.paymentMethodId,
                    }),
                });

                await this.dynamoDbClient.send(identityKeyCommand);
            }
        } catch (error) {
            this.logger.error(
                "Failed to save payment method in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    paymentMethodId: paymentMethod.paymentMethodId,
                    tableName: this.tableName,
                    component: "DynamoDbPaymentMethodRepository",
                }
            );
            throw error;
        }
    }

    async findById(paymentMethodId: string): Promise<PaymentMethod | null> {
        const command = new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({
                payment_method_id: paymentMethodId,
            }),
            ConsistentRead: true,
        });

        try {
            const response = await this.dynamoDbClient.send(command);

            if (!response.Item) {
                return null;
            }

            const dataModel = unmarshall(response.Item) as PaymentMethodDataModel;
            return this.toDomain(dataModel);
        } catch (error) {
            this.logger.error(
                "Failed to find payment method by ID in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    paymentMethodId,
                    tableName: this.tableName,
                    component: "DynamoDbPaymentMethodRepository",
                }
            );
            throw error;
        }
    }

    async findByUserAndFlow(
        userIdentifier: string,
        paymentFlow: PaymentFlow
    ): Promise<PaymentMethod[]> {
        const command = new QueryCommand({
            TableName: this.tableName,
            IndexName: this.userFlowGsiName,
            KeyConditionExpression:
                "user_id_gsi = :userIdentifier",
            FilterExpression: "payment_flow = :paymentFlow",
            ExpressionAttributeValues: marshall({
                ":userIdentifier": userIdentifier,
                ":paymentFlow": paymentFlow,
            }),
        });

        try {
            const response = await this.dynamoDbClient.send(command);

            if (!response.Items || response.Items.length === 0) {
                return [];
            }

            const dataModels = response.Items.map((item) =>
                unmarshall(item)
            ) as PaymentMethodDataModel[];

            return dataModels.map((dm) => this.toDomain(dm));
        } catch (error) {
            this.logger.error(
                "Failed to find payment methods by user and flow in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    userIdentifier: userIdentifier,
                    paymentFlow,
                    tableName: this.tableName,
                    gsiName: this.userFlowGsiName,
                    component: "DynamoDbPaymentMethodRepository",
                }
            );
            throw error;
        }
    }

    async findByIdentifier(
        identifierType: IdentifierType,
        normalizedValue: string,
        query: PaymentMethodQuery
    ): Promise<PaginatedResult<PaymentMethod>> {
        const identifierKey = `${identifierType}#${normalizedValue}`;
        const exclusiveStartKey = this.parseIdentifierPageToken(query.pageToken);
        const command = new QueryCommand({
            TableName: this.identifierTableName,
            KeyConditionExpression:
                "identifier_type_normalized_value = :identifierKey",
            ExpressionAttributeValues: marshall({
                ":identifierKey": identifierKey,
            }),
            Limit: query.pageSize,
            ExclusiveStartKey: exclusiveStartKey,
            ScanIndexForward: false,
        });

        try {
            const response = await this.dynamoDbClient.send(command);

            const identifierItems = response.Items
                ? (response.Items.map((item) =>
                    unmarshall(item)
                ) as PaymentMethodIdentifierDataModel[])
                : [];

            const paymentMethodIds = identifierItems.map(
                (item) => item.payment_method_id
            );
            const paymentMethods = await this.batchGetPaymentMethods(
                paymentMethodIds
            );

            const items = paymentMethodIds
                .map((paymentMethodId) => paymentMethods.get(paymentMethodId))
                .filter((paymentMethod): paymentMethod is PaymentMethod =>
                    Boolean(paymentMethod)
                );

            const nextPageToken = this.createIdentifierNextPageToken(
                response.LastEvaluatedKey
            );

            return {
                items,
                pageSize: query.pageSize,
                pageToken: query.pageToken,
                nextPageToken,
            };
        } catch (error) {
            this.logger.error(
                "Failed to find payment method by identifier in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    identifierType,
                    normalizedValue,
                    pageSize: query.pageSize,
                    identifierTableName: this.identifierTableName,
                    component: "DynamoDbPaymentMethodRepository",
                }
            );
            throw error;
        }
    }

    async findByIdentityKey(identityKey: string): Promise<PaymentMethod | null> {
        const identifierKey = `IDENTITY_KEY#${identityKey}`;
        const command = new QueryCommand({
            TableName: this.identifierTableName,
            KeyConditionExpression:
                "identifier_type_normalized_value = :identifierKey",
            ExpressionAttributeValues: marshall({
                ":identifierKey": identifierKey,
            }),
            Limit: 1,
            ScanIndexForward: false,
        });

        try {
            const response = await this.dynamoDbClient.send(command);

            if (!response.Items || response.Items.length === 0) {
                return null;
            }

            const identifierDataModel = unmarshall(
                response.Items[0]
            ) as PaymentMethodIdentifierDataModel;

            return this.findById(identifierDataModel.payment_method_id);
        } catch (error) {
            this.logger.error(
                "Failed to find payment method by identity key in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    identityKey,
                    identifierTableName: this.identifierTableName,
                    component: "DynamoDbPaymentMethodRepository",
                }
            );
            throw error;
        }
    }

    private parseIdentifierPageToken(
        pageToken?: string
    ): Record<string, AttributeValue> | undefined {
        if (!pageToken) {
            return undefined;
        }

        try {
            const tokenBuffer = Buffer.from(pageToken, "base64");
            const tokenData = JSON.parse(
                tokenBuffer.toString("utf-8")
            ) as Record<string, AttributeValue>;
            if (!tokenData || typeof tokenData !== "object") {
                return undefined;
            }
            return tokenData;
        } catch {
            return undefined;
        }
    }

    private createIdentifierNextPageToken(
        lastEvaluatedKey?: Record<string, AttributeValue>
    ): string | undefined {
        if (!lastEvaluatedKey) {
            return undefined;
        }

        const tokenBuffer = Buffer.from(
            JSON.stringify(lastEvaluatedKey),
            "utf-8"
        );
        return tokenBuffer.toString("base64");
    }

    private async batchGetPaymentMethods(
        paymentMethodIds: string[]
    ): Promise<Map<string, PaymentMethod>> {
        const uniqueIds = Array.from(new Set(paymentMethodIds));
        if (uniqueIds.length === 0) {
            return new Map();
        }

        const command = new BatchGetItemCommand({
            RequestItems: {
                [this.tableName]: {
                    Keys: uniqueIds.map((paymentMethodId) =>
                        marshall({
                            payment_method_id: paymentMethodId,
                        })
                    ),
                },
            },
        });

        const response = await this.dynamoDbClient.send(command);
        const items = response.Responses?.[this.tableName] || [];
        const dataModels = items.map((item) =>
            unmarshall(item)
        ) as PaymentMethodDataModel[];

        const results = new Map<string, PaymentMethod>();
        for (const dataModel of dataModels) {
            results.set(dataModel.payment_method_id, this.toDomain(dataModel));
        }

        return results;
    }

    async listByUser(
        userIdentifier: string,
        query: PaymentMethodQuery
    ): Promise<PaginatedResult<PaymentMethod>> {
        let allMethods: PaymentMethod[] = [];

        if (query.paymentFlow) {
            allMethods = await this.findByUserAndFlow(userIdentifier, query.paymentFlow);
        } else {
            const flows: PaymentFlow[] = ["PAYIN", "PAYOUT", "REFUND"];
            for (const flow of flows) {
                const methods = await this.findByUserAndFlow(userIdentifier, flow);
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
                const tokenBuffer = Buffer.from(query.pageToken, "base64");
                const tokenData = JSON.parse(tokenBuffer.toString("utf-8"));
                offset = tokenData.offset || 0;
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
            const tokenData = { offset: endIndex };
            const tokenBuffer = Buffer.from(JSON.stringify(tokenData), "utf-8");
            nextPageToken = tokenBuffer.toString("base64");
        }

        return {
            items,
            pageSize,
            pageToken: query.pageToken,
            nextPageToken,
        };
    }

    async incrementUsage(paymentMethodId: string, timestamp: Date): Promise<void> {
        const lastUsedAt = this.clock.toEpochMillis(timestamp);
        const command = new UpdateItemCommand({
            TableName: this.tableName,
            Key: marshall({
                payment_method_id: paymentMethodId,
            }),
            UpdateExpression:
                "SET usage_count = usage_count + :inc, last_used_at = :timestamp, last_used_at_gsi = :timestamp",
            ExpressionAttributeValues: marshall({
                ":inc": 1,
                ":timestamp": lastUsedAt,
            }),
        });

        try {
            await this.dynamoDbClient.send(command);
        } catch (error) {
            this.logger.error(
                "Failed to increment usage for payment method in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    paymentMethodId,
                    tableName: this.tableName,
                    component: "DynamoDbPaymentMethodRepository",
                }
            );
            throw error;
        }
    }

    private toDataModel(paymentMethod: PaymentMethod): PaymentMethodDataModel {
        const lastUsedAt = paymentMethod.lastUsedAt
            ? this.clock.toEpochMillis(paymentMethod.lastUsedAt)
            : undefined;
        return {
            payment_method_id: paymentMethod.paymentMethodId,
            user_identifier: paymentMethod.userIdentifier,
            payment_flow: paymentMethod.paymentFlow,
            method_type_id: paymentMethod.methodTypeId,
            variant: paymentMethod.variant,
            status: paymentMethod.status,
            reusable: paymentMethod.reusable,
            identity_key: paymentMethod.identityKey,
            usage_count: paymentMethod.usageCount,
            last_used_at: lastUsedAt,
            identifiers: paymentMethod.identifiers.map((id) => ({
                payment_method_id: id.paymentMethodId,
                identifier_type: id.identifierType,
                identifier_value: id.identifierValue,
                normalized_value: id.normalizedValue,
            })),
            user_id_gsi: paymentMethod.userIdentifier,
            last_used_at_gsi: lastUsedAt,
        };
    }

    private toDomain(dataModel: PaymentMethodDataModel): PaymentMethod {
        return new PaymentMethod(
            dataModel.payment_method_id,
            dataModel.user_identifier,
            dataModel.payment_flow as PaymentFlow,
            dataModel.method_type_id,
            dataModel.variant,
            dataModel.status as "ACTIVE" | "INACTIVE" | "INVALID",
            dataModel.reusable,
            dataModel.identity_key,
            dataModel.usage_count,
            dataModel.last_used_at !== undefined
                ? this.clock.fromEpochMillis(dataModel.last_used_at)
                : undefined,
            dataModel.identifiers.map(
                (id) =>
                    new PaymentMethodIdentifier(
                        id.payment_method_id,
                        id.identifier_type as IdentifierType,
                        id.identifier_value,
                        id.normalized_value
                    )
            )
        );
    }
}

