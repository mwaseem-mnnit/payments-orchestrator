/**
 * Domain event emitted when a routing rule is versioned (new version created).
 * 
 * Invariants:
 * - New version must have incremented version number
 * - Previous version is retained for history
 */
export class RoutingRuleVersioned {
    constructor(
        public readonly eventId: string,
        public readonly ruleId: string,
        public readonly previousVersion: number,
        public readonly newVersion: number,
        public readonly versionedAt: Date,
        public readonly versionedBy: string,
        public readonly changeReason: string,
        public readonly configurationId: string
    ) {}
}

