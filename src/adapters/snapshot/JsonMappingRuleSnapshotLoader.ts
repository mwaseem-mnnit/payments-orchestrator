import { readFileSync } from "fs";
import { SnapshotLoader } from "../../application/shared/snapshot/SnapshotLoader";
import { MappingRule } from "../../domain/payment_method_gateway_mapping/MappingRule";
import { MappingRuleConditions } from "../../domain/payment_method_gateway_mapping/MappingRuleConditions";
import { MappingRuleStatus } from "../../domain/payment_method_gateway_mapping/MappingRuleStatus";
import { PaymentFlow } from "../../domain/payment_intent/PaymentIntent";

/**
 * JSON-based snapshot loader for MappingRule.
 * 
 * This adapter:
 * - Reads MappingRule data from a JSON file
 * - Parses and validates the entire dataset
 * - Returns canonical MappingRule domain objects
 * - Fails fast on any validation or parsing errors
 * 
 * Invariants:
 * - No caching
 * - No refresh logic
 * - No partial loading
 * - No defaults or silent fixes
 * - Full dataset must be valid
 */
export class JsonMappingRuleSnapshotLoader implements SnapshotLoader<MappingRule> {
    constructor(private readonly filePath: string) {
        if (!filePath || filePath.trim().length === 0) {
            throw new Error("File path must be provided");
        }
    }

    async loadAll(): Promise<MappingRule[]> {
        let fileContent: string;
        try {
            fileContent = readFileSync(this.filePath, "utf-8");
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to read MappingRule snapshot file: ${this.filePath}. Error: ${error.message}`);
            }
            throw new Error(`Failed to read MappingRule snapshot file: ${this.filePath}`);
        }

        let rawData: unknown;
        try {
            rawData = JSON.parse(fileContent);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to parse MappingRule snapshot JSON: ${error.message}`);
            }
            throw new Error("Failed to parse MappingRule snapshot JSON: Invalid JSON format");
        }

        if (!Array.isArray(rawData)) {
            throw new Error("MappingRule snapshot must be a JSON array");
        }

        const mappingRules: MappingRule[] = [];

        for (let i = 0; i < rawData.length; i++) {
            const item = rawData[i];
            try {
                const mappingRule = this.parseMappingRule(item, i);
                mappingRules.push(mappingRule);
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`Invalid MappingRule at index ${i}: ${error.message}`);
                }
                throw new Error(`Invalid MappingRule at index ${i}`);
            }
        }

        return mappingRules;
    }

    /**
     * Parses a single MappingRule from raw JSON data.
     * 
     * Fails fast on any validation error.
     */
    private parseMappingRule(raw: unknown, index: number): MappingRule {
        if (typeof raw !== "object" || raw === null) {
            throw new Error("MappingRule must be an object");
        }

        const obj = raw as Record<string, unknown>;

        // Validate ruleId
        if (typeof obj.ruleId !== "string" || obj.ruleId.trim().length === 0) {
            throw new Error("ruleId is required and must be a non-empty string");
        }

        // Validate methodTypeId
        if (typeof obj.methodTypeId !== "string" || obj.methodTypeId.trim().length === 0) {
            throw new Error("methodTypeId is required and must be a non-empty string");
        }

        // Validate gatewayId
        if (typeof obj.gatewayId !== "string" || obj.gatewayId.trim().length === 0) {
            throw new Error("gatewayId is required and must be a non-empty string");
        }

        // Validate priority
        if (typeof obj.priority !== "number" || !Number.isInteger(obj.priority) || obj.priority < 1) {
            throw new Error("priority is required and must be an integer >= 1");
        }

        // Validate status
        if (obj.status !== "ACTIVE" && obj.status !== "INACTIVE") {
            throw new Error(`status must be either "ACTIVE" or "INACTIVE", got: ${obj.status}`);
        }

        // Validate version
        if (typeof obj.version !== "number" || !Number.isInteger(obj.version) || obj.version < 1) {
            throw new Error("version is required and must be an integer >= 1");
        }

        // Validate effectiveFrom
        if (typeof obj.effectiveFrom !== "string" || obj.effectiveFrom.trim().length === 0) {
            throw new Error("effectiveFrom is required and must be a non-empty ISO date string");
        }
        const effectiveFrom = this.parseDate(obj.effectiveFrom, "effectiveFrom");

        // Validate effectiveTo (optional)
        let effectiveTo: Date | undefined;
        if (obj.effectiveTo !== undefined) {
            if (typeof obj.effectiveTo !== "string" || obj.effectiveTo.trim().length === 0) {
                throw new Error("effectiveTo must be a non-empty ISO date string if provided");
            }
            effectiveTo = this.parseDate(obj.effectiveTo, "effectiveTo");
        }

        // Validate createdAt (optional)
        let createdAt: Date = new Date();
        if (obj.createdAt !== undefined) {
            if (typeof obj.createdAt !== "string" || obj.createdAt.trim().length === 0) {
                throw new Error("createdAt must be a non-empty ISO date string if provided");
            }
            createdAt = this.parseDate(obj.createdAt, "createdAt");
        }

        // Validate updatedAt (optional)
        let updatedAt: Date = new Date();
        if (obj.updatedAt !== undefined) {
            if (typeof obj.updatedAt !== "string" || obj.updatedAt.trim().length === 0) {
                throw new Error("updatedAt must be a non-empty ISO date string if provided");
            }
            updatedAt = this.parseDate(obj.updatedAt, "updatedAt");
        }

        // Validate conditions
        const conditions = this.parseConditions(obj.conditions, index);

        // Validate metadata (optional, but if present must be an object)
        let metadata: Record<string, unknown> | undefined;
        if (obj.metadata !== undefined) {
            if (typeof obj.metadata !== "object" || obj.metadata === null || Array.isArray(obj.metadata)) {
                throw new Error("metadata must be an object");
            }
            metadata = obj.metadata as Record<string, unknown>;
        }

        return new MappingRule(
            obj.ruleId.trim(),
            obj.methodTypeId.trim(),
            obj.gatewayId.trim(),
            conditions,
            obj.priority,
            obj.status as MappingRuleStatus,
            obj.version,
            effectiveFrom,
            effectiveTo,
            createdAt,
            updatedAt,
            metadata
        );
    }

    /**
     * Parses MappingRuleConditions from raw JSON data.
     */
    private parseConditions(raw: unknown, ruleIndex: number): MappingRuleConditions {
        if (typeof raw !== "object" || raw === null) {
            throw new Error("conditions is required and must be an object");
        }

        const obj = raw as Record<string, unknown>;

        // Validate paymentFlow (mandatory)
        if (obj.paymentFlow !== "PAYIN" && obj.paymentFlow !== "PAYOUT" && obj.paymentFlow !== "REFUND") {
            throw new Error(`conditions.paymentFlow must be one of: PAYIN, PAYOUT, REFUND, got: ${obj.paymentFlow}`);
        }

        // Validate region (mandatory)
        if (typeof obj.region !== "string" || obj.region.trim().length === 0) {
            throw new Error("conditions.region is required and must be a non-empty string");
        }

        // Validate currency (optional)
        let currency: string | undefined;
        if (obj.currency !== undefined) {
            if (typeof obj.currency !== "string" || obj.currency.trim().length === 0) {
                throw new Error("conditions.currency must be a non-empty string if provided");
            }
            currency = obj.currency.trim();
        }

        // Validate variant (optional)
        let variant: string | undefined;
        if (obj.variant !== undefined) {
            if (typeof obj.variant !== "string" || obj.variant.trim().length === 0) {
                throw new Error("conditions.variant must be a non-empty string if provided");
            }
            variant = obj.variant.trim();
        }

        // Validate minAmount (optional)
        let minAmount: number | undefined;
        if (obj.minAmount !== undefined) {
            if (typeof obj.minAmount !== "number" || obj.minAmount < 0) {
                throw new Error("conditions.minAmount must be a non-negative number if provided");
            }
            minAmount = obj.minAmount;
        }

        // Validate maxAmount (optional)
        let maxAmount: number | undefined;
        if (obj.maxAmount !== undefined) {
            if (typeof obj.maxAmount !== "number" || obj.maxAmount < 0) {
                throw new Error("conditions.maxAmount must be a non-negative number if provided");
            }
            maxAmount = obj.maxAmount;
        }

        // Validate customAttributes (optional, but if present must be an object)
        let customAttributes: Record<string, unknown> | undefined;
        if (obj.customAttributes !== undefined) {
            if (typeof obj.customAttributes !== "object" || obj.customAttributes === null || Array.isArray(obj.customAttributes)) {
                throw new Error("conditions.customAttributes must be an object if provided");
            }
            customAttributes = obj.customAttributes as Record<string, unknown>;
        }

        return new MappingRuleConditions(
            obj.paymentFlow as PaymentFlow,
            obj.region.trim(),
            currency,
            variant,
            minAmount,
            maxAmount,
            customAttributes
        );
    }

    /**
     * Parses an ISO date string into a Date object.
     * 
     * Fails fast on invalid date strings.
     */
    private parseDate(dateString: string, fieldName: string): Date {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            throw new Error(`${fieldName} must be a valid ISO date string, got: ${dateString}`);
        }
        return date;
    }
}
