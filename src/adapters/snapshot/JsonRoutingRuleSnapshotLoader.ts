import { readFileSync } from "fs";
import { SnapshotLoader } from "../../application/shared/snapshot/SnapshotLoader";
import { RoutingRule } from "../../domain/routing/RoutingRule";
import { RoutingRuleType } from "../../domain/routing/RoutingRuleType";
import { RoutingRuleStatus } from "../../domain/routing/RoutingRuleStatus";
import { PaymentFlow } from "../../domain/payment_intent/PaymentIntent";
import { FixedGatewayRule } from "../../domain/routing/FixedGatewayRule";
import { PercentageDistributionRule } from "../../domain/routing/PercentageDistributionRule";
import { AmountSlabRule } from "../../domain/routing/AmountSlabRule";
import { ExternalDistributionRule } from "../../domain/routing/ExternalDistributionRule";
import { GatewayDistribution } from "../../domain/routing/GatewayDistribution";
import { AmountRange } from "../../domain/routing/AmountRange";

/**
 * JSON-based snapshot loader for RoutingRule.
 * 
 * This adapter:
 * - Reads RoutingRule data from a JSON file
 * - Parses and validates the entire dataset
 * - Returns canonical RoutingRule domain objects (concrete implementations)
 * - Fails fast on any validation or parsing errors
 * 
 * Invariants:
 * - No caching
 * - No refresh logic
 * - No partial loading
 * - No defaults or silent fixes
 * - Full dataset must be valid
 */
export class JsonRoutingRuleSnapshotLoader implements SnapshotLoader<RoutingRule> {
    constructor(private readonly filePath: string) {
        if (!filePath || filePath.trim().length === 0) {
            throw new Error("File path must be provided");
        }
    }

    async loadAll(): Promise<RoutingRule[]> {
        let fileContent: string;
        try {
            fileContent = readFileSync(this.filePath, "utf-8");
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to read RoutingRule snapshot file: ${this.filePath}. Error: ${error.message}`);
            }
            throw new Error(`Failed to read RoutingRule snapshot file: ${this.filePath}`);
        }

        let rawData: unknown;
        try {
            rawData = JSON.parse(fileContent);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to parse RoutingRule snapshot JSON: ${error.message}`);
            }
            throw new Error("Failed to parse RoutingRule snapshot JSON: Invalid JSON format");
        }

        if (!Array.isArray(rawData)) {
            throw new Error("RoutingRule snapshot must be a JSON array");
        }

        const routingRules: RoutingRule[] = [];

        for (let i = 0; i < rawData.length; i++) {
            const item = rawData[i];
            try {
                const routingRule = this.parseRoutingRule(item, i);
                routingRules.push(routingRule);
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`Invalid RoutingRule at index ${i}: ${error.message}`);
                }
                throw new Error(`Invalid RoutingRule at index ${i}`);
            }
        }

        return routingRules;
    }

    /**
     * Parses a single RoutingRule from raw JSON data.
     * 
     * Routes to appropriate parser based on ruleType.
     * Fails fast on any validation error.
     */
    private parseRoutingRule(raw: unknown, index: number): RoutingRule {
        if (typeof raw !== "object" || raw === null) {
            throw new Error("RoutingRule must be an object");
        }

        const obj = raw as Record<string, unknown>;

        // Validate ruleType (required to determine which concrete class to instantiate)
        if (typeof obj.ruleType !== "string") {
            throw new Error("ruleType is required and must be a string");
        }

        const ruleType = obj.ruleType as RoutingRuleType;
        if (!["FIXED_GATEWAY", "PERCENTAGE_DISTRIBUTION", "AMOUNT_SLAB", "EXTERNAL_DISTRIBUTION"].includes(ruleType)) {
            throw new Error(`Invalid ruleType: ${ruleType}. Must be one of: FIXED_GATEWAY, PERCENTAGE_DISTRIBUTION, AMOUNT_SLAB, EXTERNAL_DISTRIBUTION`);
        }

        // Parse common base fields
        const commonFields = this.parseCommonFields(obj, index);

        // Route to specific parser based on ruleType
        switch (ruleType) {
            case "FIXED_GATEWAY":
                return this.parseFixedGatewayRule(obj, commonFields, index);
            case "PERCENTAGE_DISTRIBUTION":
                return this.parsePercentageDistributionRule(obj, commonFields, index);
            case "AMOUNT_SLAB":
                return this.parseAmountSlabRule(obj, commonFields, index);
            case "EXTERNAL_DISTRIBUTION":
                return this.parseExternalDistributionRule(obj, commonFields, index);
            default:
                throw new Error(`Unsupported ruleType: ${ruleType}`);
        }
    }

    /**
     * Parses common fields shared by all routing rules.
     */
    private parseCommonFields(obj: Record<string, unknown>, index: number): {
        ruleId: string;
        priority: number;
        status: RoutingRuleStatus;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        paymentFlowTypes?: PaymentFlow[];
        paymentMethodTypeIds?: string[];
        description?: string;
    } {
        // Validate ruleId
        if (typeof obj.ruleId !== "string" || obj.ruleId.trim().length === 0) {
            throw new Error("ruleId is required and must be a non-empty string");
        }

        // Validate priority
        if (typeof obj.priority !== "number" || obj.priority < 1) {
            throw new Error("priority is required and must be a number >= 1");
        }

        // Validate status
        if (obj.status !== "ACTIVE" && obj.status !== "INACTIVE") {
            throw new Error(`status must be either "ACTIVE" or "INACTIVE", got: ${obj.status}`);
        }

        // Validate version
        if (typeof obj.version !== "number" || obj.version < 1) {
            throw new Error("version is required and must be a number >= 1");
        }

        // Validate createdAt
        if (typeof obj.createdAt !== "string") {
            throw new Error("createdAt is required and must be an ISO date string");
        }
        const createdAt = new Date(obj.createdAt);
        if (isNaN(createdAt.getTime())) {
            throw new Error(`Invalid createdAt date: ${obj.createdAt}`);
        }

        // Validate updatedAt
        if (typeof obj.updatedAt !== "string") {
            throw new Error("updatedAt is required and must be an ISO date string");
        }
        const updatedAt = new Date(obj.updatedAt);
        if (isNaN(updatedAt.getTime())) {
            throw new Error(`Invalid updatedAt date: ${obj.updatedAt}`);
        }

        // Parse optional paymentFlowTypes
        let paymentFlowTypes: PaymentFlow[] | undefined;
        if (obj.paymentFlowTypes !== undefined) {
            if (!Array.isArray(obj.paymentFlowTypes)) {
                throw new Error("paymentFlowTypes must be an array");
            }
            paymentFlowTypes = obj.paymentFlowTypes.map((flow: unknown) => {
                if (typeof flow !== "string" || !["PAYIN", "PAYOUT", "REFUND"].includes(flow)) {
                    throw new Error(`Invalid paymentFlow: ${flow}. Must be one of: PAYIN, PAYOUT, REFUND`);
                }
                return flow as PaymentFlow;
            });
        }

        // Parse optional paymentMethodTypeIds
        let paymentMethodTypeIds: string[] | undefined;
        if (obj.paymentMethodTypeIds !== undefined) {
            if (!Array.isArray(obj.paymentMethodTypeIds)) {
                throw new Error("paymentMethodTypeIds must be an array");
            }
            paymentMethodTypeIds = obj.paymentMethodTypeIds.map((id: unknown) => {
                if (typeof id !== "string") {
                    throw new Error("paymentMethodTypeIds array must contain only strings");
                }
                return id;
            });
        }

        // Parse optional description
        const description = obj.description !== undefined ? (typeof obj.description === "string" ? obj.description : undefined) : undefined;

        return {
            ruleId: obj.ruleId,
            priority: obj.priority,
            status: obj.status as RoutingRuleStatus,
            version: obj.version,
            createdAt,
            updatedAt,
            paymentFlowTypes,
            paymentMethodTypeIds,
            description
        };
    }

    /**
     * Parses a FixedGatewayRule.
     */
    private parseFixedGatewayRule(
        obj: Record<string, unknown>,
        commonFields: ReturnType<typeof this.parseCommonFields>,
        index: number
    ): FixedGatewayRule {
        // Validate gatewayId
        if (typeof obj.gatewayId !== "string" || obj.gatewayId.trim().length === 0) {
            throw new Error("gatewayId is required and must be a non-empty string for FIXED_GATEWAY rule");
        }

        // Parse optional paymentMethodId
        const paymentMethodId = obj.paymentMethodId !== undefined ? (typeof obj.paymentMethodId === "string" ? obj.paymentMethodId : undefined) : undefined;

        return new FixedGatewayRule(
            commonFields.ruleId,
            commonFields.priority,
            commonFields.status,
            commonFields.version,
            commonFields.createdAt,
            commonFields.updatedAt,
            obj.gatewayId,
            paymentMethodId,
            commonFields.paymentFlowTypes,
            commonFields.paymentMethodTypeIds,
            commonFields.description
        );
    }

    /**
     * Parses a PercentageDistributionRule.
     */
    private parsePercentageDistributionRule(
        obj: Record<string, unknown>,
        commonFields: ReturnType<typeof this.parseCommonFields>,
        index: number
    ): PercentageDistributionRule {
        // Validate distributions
        if (!Array.isArray(obj.distributions)) {
            throw new Error("distributions is required and must be an array for PERCENTAGE_DISTRIBUTION rule");
        }

        const distributions = obj.distributions.map((dist: unknown, distIndex: number) => {
            return this.parseGatewayDistribution(dist, `distributions[${distIndex}]`);
        });

        return new PercentageDistributionRule(
            commonFields.ruleId,
            commonFields.priority,
            commonFields.status,
            commonFields.version,
            commonFields.createdAt,
            commonFields.updatedAt,
            distributions,
            commonFields.paymentFlowTypes,
            commonFields.paymentMethodTypeIds,
            commonFields.description
        );
    }

    /**
     * Parses an AmountSlabRule.
     */
    private parseAmountSlabRule(
        obj: Record<string, unknown>,
        commonFields: ReturnType<typeof this.parseCommonFields>,
        index: number
    ): AmountSlabRule {
        // Validate slabs
        if (!Array.isArray(obj.slabs)) {
            throw new Error("slabs is required and must be an array for AMOUNT_SLAB rule");
        }

        const slabs = obj.slabs.map((slab: unknown, slabIndex: number) => {
            if (typeof slab !== "object" || slab === null) {
                throw new Error(`slabs[${slabIndex}] must be an object`);
            }
            const slabObj = slab as Record<string, unknown>;

            // Parse range
            if (typeof slabObj.range !== "object" || slabObj.range === null) {
                throw new Error(`slabs[${slabIndex}].range is required and must be an object`);
            }
            const range = this.parseAmountRange(slabObj.range, `slabs[${slabIndex}].range`);

            // Parse distributions
            if (!Array.isArray(slabObj.distributions)) {
                throw new Error(`slabs[${slabIndex}].distributions is required and must be an array`);
            }
            const distributions = slabObj.distributions.map((dist: unknown, distIndex: number) => {
                return this.parseGatewayDistribution(dist, `slabs[${slabIndex}].distributions[${distIndex}]`);
            });

            return {
                range,
                distributions
            };
        });

        return new AmountSlabRule(
            commonFields.ruleId,
            commonFields.priority,
            commonFields.status,
            commonFields.version,
            commonFields.createdAt,
            commonFields.updatedAt,
            slabs,
            commonFields.paymentFlowTypes,
            commonFields.paymentMethodTypeIds,
            commonFields.description
        );
    }

    /**
     * Parses an ExternalDistributionRule.
     */
    private parseExternalDistributionRule(
        obj: Record<string, unknown>,
        commonFields: ReturnType<typeof this.parseCommonFields>,
        index: number
    ): ExternalDistributionRule {
        // Validate externalSourceId
        if (typeof obj.externalSourceId !== "string" || obj.externalSourceId.trim().length === 0) {
            throw new Error("externalSourceId is required and must be a non-empty string for EXTERNAL_DISTRIBUTION rule");
        }

        // Validate externalConfigurationVersion
        if (typeof obj.externalConfigurationVersion !== "string" || obj.externalConfigurationVersion.trim().length === 0) {
            throw new Error("externalConfigurationVersion is required and must be a non-empty string for EXTERNAL_DISTRIBUTION rule");
        }

        // Validate cachedDistributions
        if (!Array.isArray(obj.cachedDistributions)) {
            throw new Error("cachedDistributions is required and must be an array for EXTERNAL_DISTRIBUTION rule");
        }
        const cachedDistributions = obj.cachedDistributions.map((dist: unknown, distIndex: number) => {
            return this.parseGatewayDistribution(dist, `cachedDistributions[${distIndex}]`);
        });

        // Validate cachedAt
        if (typeof obj.cachedAt !== "string") {
            throw new Error("cachedAt is required and must be an ISO date string for EXTERNAL_DISTRIBUTION rule");
        }
        const cachedAt = new Date(obj.cachedAt);
        if (isNaN(cachedAt.getTime())) {
            throw new Error(`Invalid cachedAt date: ${obj.cachedAt}`);
        }

        return new ExternalDistributionRule(
            commonFields.ruleId,
            commonFields.priority,
            commonFields.status,
            commonFields.version,
            commonFields.createdAt,
            commonFields.updatedAt,
            obj.externalSourceId,
            obj.externalConfigurationVersion,
            cachedDistributions,
            cachedAt,
            commonFields.paymentFlowTypes,
            commonFields.paymentMethodTypeIds,
            commonFields.description
        );
    }

    /**
     * Parses a GatewayDistribution value object.
     */
    private parseGatewayDistribution(raw: unknown, path: string): GatewayDistribution {
        if (typeof raw !== "object" || raw === null) {
            throw new Error(`${path} must be an object`);
        }

        const obj = raw as Record<string, unknown>;

        // Validate gatewayId
        if (typeof obj.gatewayId !== "string" || obj.gatewayId.trim().length === 0) {
            throw new Error(`${path}.gatewayId is required and must be a non-empty string`);
        }

        // Validate percentage
        if (typeof obj.percentage !== "number") {
            throw new Error(`${path}.percentage is required and must be a number`);
        }

        return new GatewayDistribution(obj.gatewayId, obj.percentage);
    }

    /**
     * Parses an AmountRange value object.
     */
    private parseAmountRange(raw: unknown, path: string): AmountRange {
        if (typeof raw !== "object" || raw === null) {
            throw new Error(`${path} must be an object`);
        }

        const obj = raw as Record<string, unknown>;

        // Validate minAmount
        if (typeof obj.minAmount !== "number") {
            throw new Error(`${path}.minAmount is required and must be a number`);
        }

        // Validate maxAmount
        if (typeof obj.maxAmount !== "number") {
            throw new Error(`${path}.maxAmount is required and must be a number`);
        }

        return new AmountRange(obj.minAmount, obj.maxAmount);
    }
}
