import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    PutItemCommand,
    ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { IdempotencyStore } from "../../../application/port/IdempotencyStore";
import { Clock } from "../../../application/port/Clock";
import { Logger } from "../../../application/port/Logger";

interface IdempotencyDataModel {
    idempotency_key: string;
    expires_at: number; // Epoch seconds for TTL
}

export class DynamoDbIdempotencyStore implements IdempotencyStore {
    constructor(
        private readonly dynamoDbClient: DynamoDBClient,
        private readonly tableName: string,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {}

    async tryAcquire(key: string, ttlMs: number): Promise<boolean> {
        const now = this.clock.now();
        const nowMs = now.getTime();
        const expiresAtSeconds = Math.floor((nowMs + ttlMs) / 1000);

        const dataModel: IdempotencyDataModel = {
            idempotency_key: key,
            expires_at: expiresAtSeconds,
        };

        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(dataModel),
            ConditionExpression: "attribute_not_exists(idempotency_key)",
        });

        try {
            await this.dynamoDbClient.send(command);
            return true;
        } catch (error) {
            if (error instanceof ConditionalCheckFailedException) {
                // Key already exists and is still active - expected condition
                return false;
            }
            // Unexpected DynamoDB failure - log it
            this.logger.error(
                "Failed to acquire idempotency key in DynamoDB",
                error instanceof Error ? error : new Error(String(error)),
                {
                    key,
                    tableName: this.tableName,
                }
            );
            throw error;
        }
    }
}

