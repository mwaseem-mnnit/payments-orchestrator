import { RoutingRule } from "./RoutingRule";
import { RoutingDecision } from "./RoutingDecision";
import { RoutingContext } from "./RoutingContext";
import { RoutingHistoryEntry } from "./RoutingHistoryEntry";
import { GatewayHealthStatus } from "./GatewayHealthStatus";

/**
 * Aggregate root for Gateway Routing domain.
 * 
 * Manages routing rules and orchestrates routing decisions.
 * 
 * Invariants:
 * - Rules are stored in priority order (lower priority number = higher precedence)
 * - Only ACTIVE rules are evaluated
 * - First matching rule wins
 * - Fallback gateway must be specified
 * - Configuration changes create new history entries (append-only)
 */
export class RoutingConfiguration {
    private readonly rules: RoutingRule[] = [];
    private readonly history: RoutingHistoryEntry[] = [];

    constructor(
        public readonly configurationId: string,
        public readonly fallbackGatewayId: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {
        if (!fallbackGatewayId || fallbackGatewayId.trim().length === 0) {
            throw new Error("Fallback gateway ID must be specified");
        }
    }

    /**
     * Adds a routing rule to the configuration.
     * Rules are maintained in priority order.
     * 
     * Invariant: Rule IDs must be unique within configuration
     */
    addRule(rule: RoutingRule): void {
        // Check for duplicate rule ID
        if (this.rules.some(r => r.ruleId === rule.ruleId && r.version === rule.version)) {
            throw new Error(`Rule ${rule.ruleId} version ${rule.version} already exists`);
        }

        // Insert in priority order (lower priority number = earlier in array)
        const insertIndex = this.rules.findIndex(r => r.priority > rule.priority);
        if (insertIndex === -1) {
            this.rules.push(rule);
        } else {
            this.rules.splice(insertIndex, 0, rule);
        }
    }

    /**
     * Removes a rule by ID and version.
     */
    removeRule(ruleId: string, version: number): void {
        const index = this.rules.findIndex(r => r.ruleId === ruleId && r.version === version);
        if (index !== -1) {
            this.rules.splice(index, 1);
        }
    }

    /**
     * Gets all active rules in priority order.
     */
    getActiveRules(): RoutingRule[] {
        return this.rules.filter(r => r.isActive());
    }

    /**
     * Gets all rules (active and inactive).
     */
    getAllRules(): RoutingRule[] {
        return [...this.rules];
    }

    /**
     * Gets a rule by ID and version.
     */
    getRule(ruleId: string, version: number): RoutingRule | null {
        return this.rules.find(r => r.ruleId === ruleId && r.version === version) || null;
    }

    /**
     * Adds a history entry for rule changes.
     * History is append-only and immutable.
     */
    addHistoryEntry(entry: RoutingHistoryEntry): void {
        this.history.push(entry);
    }

    /**
     * Gets history entries for a specific rule, ordered by timestamp.
     */
    getRuleHistory(ruleId: string): RoutingHistoryEntry[] {
        return this.history
            .filter(entry => entry.ruleId === ruleId)
            .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
    }

    /**
     * Gets all history entries, ordered by timestamp.
     */
    getAllHistory(): RoutingHistoryEntry[] {
        return [...this.history].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
    }

    /**
     * Makes a routing decision based on context and eligible gateways.
     * 
     * This method orchestrates the routing decision process:
     * 1. Filters eligible gateways based on health
     * 2. Evaluates rules in priority order
     * 3. First matching rule selects the gateway
     * 4. Falls back if selected gateway is unavailable
     * 
     * Invariants:
     * - Rules are evaluated in priority order
     * - First matching rule wins
     * - UNAVAILABLE gateways are excluded
     * - Fallback is only used if primary selection is unavailable
     */
    makeDecision(
        context: RoutingContext,
        eligibleGateways: string[],
        gatewayHealth: Map<string, GatewayHealthStatus>
    ): RoutingDecision {
        // Filter out unavailable gateways
        const healthyEligibleGateways = eligibleGateways.filter(gw => {
            const health = gatewayHealth.get(gw);
            return health !== "UNAVAILABLE";
        });

        const excludedGateways = eligibleGateways.filter(gw => !healthyEligibleGateways.includes(gw));

        // Evaluate rules in priority order
        const activeRules = this.getActiveRules();
        for (const rule of activeRules) {
            if (rule.matches(context, healthyEligibleGateways)) {
                const selectedGateway = rule.selectGateway(
                    context,
                    healthyEligibleGateways,
                    gatewayHealth as Map<string, string>
                );

                if (selectedGateway) {
                    return new RoutingDecision(
                        selectedGateway,
                        rule.ruleId,
                        rule.version,
                        rule.ruleType,
                        rule.getExplanation(context, selectedGateway),
                        context,
                        healthyEligibleGateways,
                        excludedGateways
                    );
                }
                // Rule matched but couldn't select (all gateways unavailable)
                // Continue to next rule or fallback
            }
        }

        // No rule matched or all matched rules failed - use fallback
        const fallbackHealth = gatewayHealth.get(this.fallbackGatewayId);
        if (fallbackHealth && fallbackHealth !== "UNAVAILABLE") {
            return RoutingDecision.withFallback(
                this.fallbackGatewayId,
                "FALLBACK",
                0,
                "FALLBACK",
                `Fallback gateway ${this.fallbackGatewayId} selected`,
                context,
                healthyEligibleGateways,
                excludedGateways,
                "No matching rule or all selected gateways unavailable"
            );
        }

        // No gateway available
        return RoutingDecision.noGatewayAvailable(
            null,
            null,
            context,
            healthyEligibleGateways,
            excludedGateways,
            "No eligible gateway and fallback unavailable"
        );
    }
}

