import { MappingRule } from "../../domain/payment_method_gateway_mapping/MappingRule";
import { MappingRuleRepository } from "../../domain/payment_method_gateway_mapping/MappingRuleRepository";
import { SnapshotStore } from "../../application/shared/snapshot/SnapshotStore";

/**
 * Repository implementation for MappingRule that reads from SnapshotStore.
 * 
 * This adapter:
 * - Reads ONLY from SnapshotStore (no loading or refresh logic)
 * - Applies ACTIVE status and effective date filtering via isActiveAndEffective()
 * - Applies priority-based sorting (lower number = higher priority)
 * - Provides deterministic reads
 * - Performs no I/O operations
 * 
 * Invariants:
 * - No JSON, DB, or S3 logic
 * - No caching logic (SnapshotStore handles that)
 * - Deterministic reads only
 * - Returns only ACTIVE and effective rules, sorted by priority
 */
export class MappingRuleRepositoryImpl implements MappingRuleRepository {
    constructor(private readonly snapshotStore: SnapshotStore<MappingRule>) {
        if (!snapshotStore) {
            throw new Error("SnapshotStore must be provided");
        }
    }

    /**
     * Gets all active and effective mapping rules.
     * 
     * Filters rules using isActiveAndEffective() and sorts by priority
     * (lower priority number = higher precedence, sorted ascending).
     * 
     * @returns Promise resolving to array of active and effective MappingRules, sorted by priority
     */
    async getAllActiveRules(): Promise<MappingRule[]> {
        const allRules = this.snapshotStore.getAll();
        const activeRules = allRules.filter((rule) => rule.isActiveAndEffective());
        
        // Sort by priority (ascending - lower number = higher priority)
        return activeRules.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Gets mapping rules for a specific method type and gateway.
     * 
     * Filters by:
     * - isActiveAndEffective() status check
     * - methodTypeId match
     * - gatewayId match
     * 
     * Results are sorted by priority (lower number = higher precedence).
     * 
     * @param methodTypeId The payment method type identifier
     * @param gatewayId The gateway identifier
     * @returns Promise resolving to array of matching MappingRules, sorted by priority
     */
    async getRulesByMethodTypeAndGateway(
        methodTypeId: string,
        gatewayId: string
    ): Promise<MappingRule[]> {
        if (!methodTypeId || methodTypeId.trim().length === 0) {
            return [];
        }
        if (!gatewayId || gatewayId.trim().length === 0) {
            return [];
        }

        const allRules = this.snapshotStore.getAll();
        const matchingRules = allRules.filter(
            (rule) =>
                rule.isActiveAndEffective() &&
                rule.methodTypeId === methodTypeId &&
                rule.gatewayId === gatewayId
        );

        // Sort by priority (ascending - lower number = higher priority)
        return matchingRules.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Gets mapping rules for a specific method type.
     * 
     * Filters by:
     * - isActiveAndEffective() status check
     * - methodTypeId match
     * 
     * Results are sorted by priority (lower number = higher precedence).
     * 
     * @param methodTypeId The payment method type identifier
     * @returns Promise resolving to array of matching MappingRules, sorted by priority
     */
    async getRulesByMethodType(methodTypeId: string): Promise<MappingRule[]> {
        if (!methodTypeId || methodTypeId.trim().length === 0) {
            return [];
        }

        const allRules = this.snapshotStore.getAll();
        const matchingRules = allRules.filter(
            (rule) =>
                rule.isActiveAndEffective() &&
                rule.methodTypeId === methodTypeId
        );

        // Sort by priority (ascending - lower number = higher priority)
        return matchingRules.sort((a, b) => a.priority - b.priority);
    }
}
