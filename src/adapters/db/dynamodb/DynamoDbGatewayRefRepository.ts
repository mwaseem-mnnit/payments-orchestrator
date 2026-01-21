import {
    DynamoDBClient,
    PutItemCommand,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {marshall, unmarshall} from "@aws-sdk/util-dynamodb";
import {GatewayRef, GatewayRefStatus} from "../../../domain/gateway_ref/GatewayRef";
import {GatewayRefRepository} from "../../../application/port/GatewayRefRepository";
import {Clock} from "../../../application/port/Clock";
import {Logger} from "../../../application/port/Logger";

interface GatewayRefDataModel {
    gateway_ref_id: string;
    payment_method_id: string;
    gateway_id: string;
    normalized_key: string;
    metadata: Record<string, unknown>;
    status: string;
    created_at: string;
    updated_at: string;
}

export class DynamoDbGatewayRefRepository implements GatewayRefRepository {
    constructor(
        private readonly dynamoDbClient: DynamoDBClient,
        private readonly tableName: string,
        private readonly gsi1Name: string,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {}

    async findByPaymentMethodAndGateway(
        paymentMethodId: string,
        gatewayId: string
    ): Promise<GatewayRef | null> {
        const command = new QueryCommand({
            TableName: this.tableName,
            IndexName: this.gsi1Name,
            KeyConditionExpression:
                "payment_method_id = :paymentMethodId AND gateway_id = :gatewayId",
            FilterExpression: "#status = :status",
            ExpressionAttributeValues: marshall({
                ":paymentMethodId": paymentMethodId,
                ":gatewayId": gatewayId,
                ":status": "ACTIVE",
            }),
            ExpressionAttributeNames: {
                "#status": "status",
            },
            Limit: 1,
        });

        const response = await this.dynamoDbClient.send(command);

        if (!response.Items || response.Items.length === 0) {
            return null;
        }

        const dataModel = unmarshall(response.Items[0]) as GatewayRefDataModel;
        return this.toDomain(dataModel);
    }

    async save(gatewayRef: GatewayRef): Promise<void> {
        const dataModel = this.toDataModel(gatewayRef);
        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(dataModel),
        });

        await this.dynamoDbClient.send(command);
    }

    async update(gatewayRef: GatewayRef): Promise<void> {
        const dataModel = this.toDataModel(gatewayRef);
        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(dataModel),
        });

        await this.dynamoDbClient.send(command);
    }

    private toDataModel(gatewayRef: GatewayRef): GatewayRefDataModel {
        return {
            gateway_ref_id: gatewayRef.gatewayRefId,
            payment_method_id: gatewayRef.paymentMethodId,
            gateway_id: gatewayRef.gatewayId,
            normalized_key: gatewayRef.normalizedKey,
            metadata: gatewayRef.metadata,
            status: gatewayRef.status,
            created_at: gatewayRef.createdAt.toISOString(),
            updated_at: gatewayRef.updatedAt.toISOString(),
        };
    }

    private toDomain(dataModel: GatewayRefDataModel): GatewayRef {
        return new GatewayRef(
            dataModel.gateway_ref_id,
            dataModel.payment_method_id,
            dataModel.gateway_id,
            dataModel.normalized_key,
            dataModel.metadata,
            dataModel.status as GatewayRefStatus,
            this.clock.fromIsoString(dataModel.created_at),
            this.clock.fromIsoString(dataModel.updated_at)
        );
    }
}

