import { RoutingRule } from "../../domain/routing/RoutingRule";
import { RoutingRuleRepository } from "../../domain/routing/RoutingRuleRepository";
import { SnapshotStore } from "../../application/shared/snapshot/SnapshotStore";

/**
 * Repository implementation for RoutingRule that reads from SnapshotStore.
 * 
 * This adapter:
 * - Reads ONLY from SnapshotStore (no loading or refresh logic)
 * - Applies ACTIVE status filtering via isActive()
 * - Applies priority-based sorting (lower number = higher priority)
 * - Provides deterministic reads
 * - Performs no I/O operations
 * 
 * Invariants:
 * - No JSON, DB, or S3 logic
 * - No caching logic (SnapshotStore handles that)
 * - Deterministic reads only
 * - Returns only ACTIVE rules, sorted by priority
 */
export class RoutingRuleRepositoryImpl implements RoutingRuleRepository {
    constructor(private readonly snapshotStore: SnapshotStore<RoutingRule>) {
        if (!snapshotStore) {
            throw new Error("SnapshotStore must be provided");
        }
    }

    /**
     * Gets all active routing rules.
     * 
     * Filters rules using isActive() and sorts by priority
     * (lower priority number = higher precedence, sorted ascending).
     * 
     * @returns Promise resolving to array of active RoutingRules, sorted by priority
     */
    async findAllActive(): Promise<RoutingRule[]> {
        const allRules = this.snapshotStore.getAll();
        const activeRules = allRules.filter((rule) => rule.isActive());
        
        // Sort by priority (ascending - lower number = higher priority)
        return activeRules.sort((a, b) => a.priority - b.priority);
    }
}
