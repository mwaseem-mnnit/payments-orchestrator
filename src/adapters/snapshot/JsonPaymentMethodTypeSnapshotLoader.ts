import { readFileSync } from "fs";
import { SnapshotLoader } from "../../application/shared/snapshot/SnapshotLoader";
import { PaymentMethodType, PaymentMethodTypeStatus, IdentifierType } from "../../domain/payment_method_type/PaymentMethodType";
import { PaymentFlow } from "../../domain/payment_intent/PaymentIntent";

/**
 * JSON-based snapshot loader for PaymentMethodType.
 * 
 * This adapter:
 * - Reads PaymentMethodType data from a JSON file
 * - Parses and validates the entire dataset
 * - Returns canonical PaymentMethodType domain objects
 * - Fails fast on any validation or parsing errors
 * 
 * Invariants:
 * - No caching
 * - No refresh logic
 * - No partial loading
 * - No defaults or silent fixes
 * - Full dataset must be valid
 */
export class JsonPaymentMethodTypeSnapshotLoader implements SnapshotLoader<PaymentMethodType> {
    constructor(private readonly filePath: string) {
        if (!filePath || filePath.trim().length === 0) {
            throw new Error("File path must be provided");
        }
    }

    async loadAll(): Promise<PaymentMethodType[]> {
        let fileContent: string;
        try {
            fileContent = readFileSync(this.filePath, "utf-8");
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to read PaymentMethodType snapshot file: ${this.filePath}. Error: ${error.message}`);
            }
            throw new Error(`Failed to read PaymentMethodType snapshot file: ${this.filePath}`);
        }

        let rawData: unknown;
        try {
            rawData = JSON.parse(fileContent);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to parse PaymentMethodType snapshot JSON: ${error.message}`);
            }
            throw new Error("Failed to parse PaymentMethodType snapshot JSON: Invalid JSON format");
        }

        if (!Array.isArray(rawData)) {
            throw new Error("PaymentMethodType snapshot must be a JSON array");
        }

        const paymentMethodTypes: PaymentMethodType[] = [];

        for (let i = 0; i < rawData.length; i++) {
            const item = rawData[i];
            try {
                const paymentMethodType = this.parsePaymentMethodType(item, i);
                paymentMethodTypes.push(paymentMethodType);
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`Invalid PaymentMethodType at index ${i}: ${error.message}`);
                }
                throw new Error(`Invalid PaymentMethodType at index ${i}`);
            }
        }

        return paymentMethodTypes;
    }

    /**
     * Parses a single PaymentMethodType from raw JSON data.
     * 
     * Fails fast on any validation error.
     */
    private parsePaymentMethodType(raw: unknown, index: number): PaymentMethodType {
        if (typeof raw !== "object" || raw === null) {
            throw new Error("PaymentMethodType must be an object");
        }

        const obj = raw as Record<string, unknown>;

        // Validate methodTypeId
        if (typeof obj.methodTypeId !== "string" || obj.methodTypeId.trim().length === 0) {
            throw new Error("methodTypeId is required and must be a non-empty string");
        }

        // Validate displayName
        if (typeof obj.displayName !== "string" || obj.displayName.trim().length === 0) {
            throw new Error("displayName is required and must be a non-empty string");
        }

        // Validate status
        if (obj.status !== "ACTIVE" && obj.status !== "INACTIVE") {
            throw new Error(`status must be either "ACTIVE" or "INACTIVE", got: ${obj.status}`);
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

        // Validate allowedIdentifierTypes
        if (!Array.isArray(obj.allowedIdentifierTypes)) {
            throw new Error("allowedIdentifierTypes must be an array");
        }
        const allowedIdentifierTypes: IdentifierType[] = [];
        const validIdentifierTypes: IdentifierType[] = ["UPI_VPA", "BANK_ACCOUNT", "EMAIL", "MOBILE", "CARD_INSTRUMENT"];
        for (const identifierType of obj.allowedIdentifierTypes) {
            if (!validIdentifierTypes.includes(identifierType)) {
                throw new Error(`Invalid identifierType: ${identifierType}. Must be one of: ${validIdentifierTypes.join(", ")}`);
            }
            allowedIdentifierTypes.push(identifierType);
        }
        if (allowedIdentifierTypes.length === 0) {
            throw new Error("allowedIdentifierTypes must contain at least one identifier type");
        }

        // Validate supportsVariants
        if (typeof obj.supportsVariants !== "boolean") {
            throw new Error("supportsVariants must be a boolean");
        }

        // Validate metadata (optional, but if present must be an object)
        let metadata: Record<string, unknown> = {};
        if (obj.metadata !== undefined) {
            if (typeof obj.metadata !== "object" || obj.metadata === null || Array.isArray(obj.metadata)) {
                throw new Error("metadata must be an object");
            }
            metadata = obj.metadata as Record<string, unknown>;
        }

        return new PaymentMethodType(
            obj.methodTypeId.trim(),
            obj.displayName.trim(),
            obj.status as PaymentMethodTypeStatus,
            supportedFlows,
            allowedIdentifierTypes,
            obj.supportsVariants,
            metadata
        );
    }
}
