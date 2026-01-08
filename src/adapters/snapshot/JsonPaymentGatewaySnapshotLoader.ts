import { readFileSync } from "fs";
import { SnapshotLoader } from "../../application/shared/snapshot/SnapshotLoader";
import { PaymentGateway, PaymentGatewayStatus } from "../../domain/gateway/PaymentGateway";
import { PaymentFlow } from "../../domain/payment_intent/PaymentIntent";

/**
 * JSON-based snapshot loader for PaymentGateway.
 * 
 * This adapter:
 * - Reads PaymentGateway data from a JSON file
 * - Parses and validates the entire dataset
 * - Returns canonical PaymentGateway domain objects
 * - Fails fast on any validation or parsing errors
 * 
 * Invariants:
 * - No caching
 * - No refresh logic
 * - No partial loading
 * - No defaults or silent fixes
 * - Full dataset must be valid
 */
export class JsonPaymentGatewaySnapshotLoader implements SnapshotLoader<PaymentGateway> {
    constructor(private readonly filePath: string) {
        if (!filePath || filePath.trim().length === 0) {
            throw new Error("File path must be provided");
        }
    }

    async loadAll(): Promise<PaymentGateway[]> {
        let fileContent: string;
        try {
            fileContent = readFileSync(this.filePath, "utf-8");
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to read PaymentGateway snapshot file: ${this.filePath}. Error: ${error.message}`);
            }
            throw new Error(`Failed to read PaymentGateway snapshot file: ${this.filePath}`);
        }

        let rawData: unknown;
        try {
            rawData = JSON.parse(fileContent);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to parse PaymentGateway snapshot JSON: ${error.message}`);
            }
            throw new Error("Failed to parse PaymentGateway snapshot JSON: Invalid JSON format");
        }

        if (!Array.isArray(rawData)) {
            throw new Error("PaymentGateway snapshot must be a JSON array");
        }

        const paymentGateways: PaymentGateway[] = [];

        for (let i = 0; i < rawData.length; i++) {
            const item = rawData[i];
            try {
                const paymentGateway = this.parsePaymentGateway(item, i);
                paymentGateways.push(paymentGateway);
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`Invalid PaymentGateway at index ${i}: ${error.message}`);
                }
                throw new Error(`Invalid PaymentGateway at index ${i}`);
            }
        }

        return paymentGateways;
    }

    /**
     * Parses a single PaymentGateway from raw JSON data.
     * 
     * Fails fast on any validation error.
     */
    private parsePaymentGateway(raw: unknown, index: number): PaymentGateway {
        if (typeof raw !== "object" || raw === null) {
            throw new Error("PaymentGateway must be an object");
        }

        const obj = raw as Record<string, unknown>;

        // Validate gatewayId
        if (typeof obj.gatewayId !== "string" || obj.gatewayId.trim().length === 0) {
            throw new Error("gatewayId is required and must be a non-empty string");
        }

        // Validate displayName
        if (typeof obj.displayName !== "string" || obj.displayName.trim().length === 0) {
            throw new Error("displayName is required and must be a non-empty string");
        }

        // Validate status
        if (obj.status !== "ENABLED" && obj.status !== "DISABLED") {
            throw new Error(`status must be either "ENABLED" or "DISABLED", got: ${obj.status}`);
        }

        // Validate supportedFlows
        if (!Array.isArray(obj.supportedFlows)) {
            throw new Error("supportedFlows must be an array");
        }
        const supportedFlows: PaymentFlow[] = [];
        for (const flow of obj.supportedFlows) {
            if (flow !== "PAYIN" && flow !== "PAYOUT" && flow !== "REFUND") {
                throw new Error(`Invalid payment flow: ${flow}. Must be one of: PAYIN, PAYOUT, REFUND`);
            }
            supportedFlows.push(flow);
        }
        if (supportedFlows.length === 0) {
            throw new Error("supportedFlows must contain at least one flow");
        }

        // Validate supportedMethodTypes
        if (!Array.isArray(obj.supportedMethodTypes)) {
            throw new Error("supportedMethodTypes must be an array");
        }
        const supportedMethodTypes: string[] = [];
        for (const methodType of obj.supportedMethodTypes) {
            if (typeof methodType !== "string" || methodType.trim().length === 0) {
                throw new Error("All supportedMethodTypes must be non-empty strings");
            }
            supportedMethodTypes.push(methodType.trim());
        }

        // Validate regions
        if (!Array.isArray(obj.regions)) {
            throw new Error("regions must be an array");
        }
        const regions: string[] = [];
        for (const region of obj.regions) {
            if (typeof region !== "string" || region.trim().length === 0) {
                throw new Error("All regions must be non-empty strings");
            }
            regions.push(region.trim());
        }

        // Validate metadata (optional, but if present must be an object)
        let metadata: Record<string, unknown> = {};
        if (obj.metadata !== undefined) {
            if (typeof obj.metadata !== "object" || obj.metadata === null || Array.isArray(obj.metadata)) {
                throw new Error("metadata must be an object");
            }
            metadata = obj.metadata as Record<string, unknown>;
        }

        return new PaymentGateway(
            obj.gatewayId.trim(),
            obj.displayName.trim(),
            obj.status as PaymentGatewayStatus,
            supportedFlows,
            supportedMethodTypes,
            regions,
            metadata
        );
    }
}
