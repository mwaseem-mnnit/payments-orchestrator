/**
 * Domain event emitted when a new routing rule is created.
 * 
 * Invariants:
 * - Rule must be in INACTIVE status when created (activated separately)
 * - Event must include full rule snapshot
 */
export class RoutingRuleCreated {
    constructor(
        public readonly eventId: string,
        public readonly ruleId: string,
        public readonly ruleType: string,
        public readonly version: number,
        public readonly priority: number,
        public readonly createdAt: Date,
        public readonly configurationId: string
    ) {}
}

