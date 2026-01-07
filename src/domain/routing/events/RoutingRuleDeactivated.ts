/**
 * Domain event emitted when a routing rule is deactivated.
 * 
 * Invariants:
 * - Rule must have been previously ACTIVE
 * - Event must reference the rule version
 */
export class RoutingRuleDeactivated {
    constructor(
        public readonly eventId: string,
        public readonly ruleId: string,
        public readonly version: number,
        public readonly deactivatedAt: Date,
        public readonly deactivatedBy: string,
        public readonly reason: string,
        public readonly configurationId: string
    ) {}
}

