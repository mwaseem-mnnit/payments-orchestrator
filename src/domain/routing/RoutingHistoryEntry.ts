import { RoutingRule } from "./RoutingRule";
import { RoutingRuleStatus } from "./RoutingRuleStatus";

/**
 * Entity representing a historical entry for routing rule changes.
 * Used for audit trail and rule versioning.
 * 
 * Invariants:
 * - History is append-only (immutable)
 * - Each entry represents a state change
 * - Entries are ordered by timestamp
 */
export class RoutingHistoryEntry {
    constructor(
        public readonly entryId: string,
        public readonly ruleId: string,
        public readonly ruleVersion: number,
        public readonly previousVersion: number | null,
        public readonly previousStatus: RoutingRuleStatus | null,
        public readonly newStatus: RoutingRuleStatus,
        public readonly changedBy: string,
        public readonly changeReason: string,
        public readonly changedAt: Date,
        public readonly ruleSnapshot: RoutingRule
    ) {}
}

