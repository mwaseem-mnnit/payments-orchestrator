/**
 * Domain event emitted when a routing rule is activated.
 * 
 * Invariants:
 * - Rule must have been previously INACTIVE
 * - Event must reference the rule version
 */
export class RoutingRuleActivated {
    constructor(
        public readonly eventId: string,
        public readonly ruleId: string,
        public readonly version: number,
        public readonly activatedAt: Date,
        public readonly activatedBy: string,
        public readonly configurationId: string
    ) {}
}

