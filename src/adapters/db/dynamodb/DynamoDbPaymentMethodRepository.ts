import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
    UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import {marshall, unmarshall} from "@aws-sdk/util-dynamodb";
import {IdentifierType, PaymentMethod, PaymentMethodIdentifier} from "../../../domain/payment_method/PaymentMethod";
import {PaymentFlow} from "../../../domain/payment_intent/PaymentIntent";
import {PaymentMethodQuery, PaymentMethodRepository,} from "../../../application/port/PaymentMethodRepository";
import {PaginatedResult} from "../../../application/shared/pagination/PaginatedResult";
import {Logger} from "../../../application/port/Logger";

interface PaymentMethodDataModel {
    payment_method_id: string;
    user_identifier: string;
    payment_flow: string;
    method_type_id: string;
    variant?: string;
    status: string;
    reusable: boolean;
    usage_count: number;
    last_used_at?: string;
    identifiers: Array<{
        payment_method_id: string;
        identifier_type: string;
        identifier_value: string;
        normalized_value: string;
    }>;
    user_id_gsi?: string; // GSI partition key
    payment_flow_gsi?: string; // GSI sort key
}

interface PaymentMethodIdentifierDataModel {
    identifier_type_normalized_value: string; // PK: identifier_type#normalized_value
    payment_method_id: string;
}

export class DynamoDbPaymentMethodRepository implements PaymentMethodRepository {
    constructor(
        private readonly dynamoDbClient: DynamoDBClient,
        private readonly tableName: string,
        private readonly userFlowGsiName: string,
        private readonly identifierTableName: string,
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
            for (const identifier of paymentMethod.identifiers) {
                const identifierDataModel: PaymentMethodIdentifierDataModel = {
                    identifier_type_normalized_value: `${identifier.identifierType}#${identifier.normalizedValue}`,
                    payment_method_id: paymentMethod.paymentMethodId,
                };

                const identifierCommand = new PutItemCommand({
                    TableName: this.identifierTableName,
                    Item: marshall(identifierDataModel),
                });

                await this.dynamoDbClient.send(identifierCommand);
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
                "user_id_gsi = :userIdentifier AND payment_flow_gsi = :paymentFlow",
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
        normalizedValue: string
    ): Promise<PaymentMethod | null> {
        const identifierKey = `${identifierType}#${normalizedValue}`;

        const command = new GetItemCommand({
            TableName: this.identifierTableName,
            Key: marshall({
                identifier_type_normalized_value: identifierKey,
            }),
        });

        try {
            const response = await this.dynamoDbClient.send(command);

            if (!response.Item) {
                return null;
            }

            const identifierDataModel = unmarshall(
                response.Item
            ) as PaymentMethodIdentifierDataModel;

            return this.findById(identifierDataModel.payment_method_id);
        } catch (error) {
            this.logger.error(
                "Failed to find payment method by identifier in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    identifierType,
                    normalizedValue,
                    identifierTableName: this.identifierTableName,
                    component: "DynamoDbPaymentMethodRepository",
                }
            );
            throw error;
        }
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
        const command = new UpdateItemCommand({
            TableName: this.tableName,
            Key: marshall({
                payment_method_id: paymentMethodId,
            }),
            UpdateExpression:
                "SET usage_count = usage_count + :inc, last_used_at = :timestamp",
            ExpressionAttributeValues: marshall({
                ":inc": 1,
                ":timestamp": timestamp.toISOString(),
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
        return {
            payment_method_id: paymentMethod.paymentMethodId,
            user_identifier: paymentMethod.userIdentifier,
            payment_flow: paymentMethod.paymentFlow,
            method_type_id: paymentMethod.methodTypeId,
            variant: paymentMethod.variant,
            status: paymentMethod.status,
            reusable: paymentMethod.reusable,
            usage_count: paymentMethod.usageCount,
            last_used_at: paymentMethod.lastUsedAt?.toISOString(),
            identifiers: paymentMethod.identifiers.map((id) => ({
                payment_method_id: id.paymentMethodId,
                identifier_type: id.identifierType,
                identifier_value: id.identifierValue,
                normalized_value: id.normalizedValue,
            })),
            user_id_gsi: paymentMethod.userIdentifier,
            payment_flow_gsi: paymentMethod.paymentFlow,
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
            dataModel.usage_count,
            dataModel.last_used_at ? new Date(dataModel.last_used_at) : undefined,
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

