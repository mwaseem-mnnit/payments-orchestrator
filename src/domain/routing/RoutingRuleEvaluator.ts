import { RoutingRule } from "./RoutingRule";
import { RoutingContext } from "./RoutingContext";
import { RoutingDecision } from "./RoutingDecision";
import { GatewayHealthStatus } from "./GatewayHealthStatus";

/**
 * Pure domain service for evaluating routing rules.
 * 
 * This service is stateless and deterministic. It evaluates routing rules
 * in priority order and returns a routing decision.
 * 
 * Invariants:
 * - Deterministic (same inputs produce same outputs)
 * - No mutation (does not modify input parameters)
 * - No side effects (pure function)
 * - Rules are evaluated in priority order (lower priority number = higher precedence)
 * - Only ACTIVE rules are evaluated
 * - First matching rule wins
 */
export class RoutingRuleEvaluator {
    /**
     * Evaluates routing rules and returns a routing decision.
     * 
     * Process:
     * 1. Filters eligibleGateways to exclude UNAVAILABLE gateways
     * 2. Evaluates ACTIVE rules sorted by priority (ASC)
     * 3. First matching rule selects a gateway
     * 4. If no rule selects, falls back to fallbackGatewayId if available and healthy
     * 5. Otherwise returns NO_GATEWAY decision
     * 
     * @param context The routing context
     * @param rules The routing rules to evaluate (should be pre-filtered if needed)
     * @param eligibleGateways List of gateway IDs that passed eligibility filtering
     * @param gatewayHealth Map of gateway ID to health status
     * @param fallbackGatewayId Optional fallback gateway ID
     * @returns RoutingDecision with selected gateway or NO_GATEWAY
     */
    evaluate(
        context: RoutingContext,
        rules: RoutingRule[],
        eligibleGateways: string[],
        gatewayHealth: Map<string, GatewayHealthStatus>,
        fallbackGatewayId?: string
    ): RoutingDecision {
        // Step 1: Filter out UNAVAILABLE gateways
        const healthyEligibleGateways = eligibleGateways.filter(gw => {
            const health = gatewayHealth.get(gw);
            return health !== "UNAVAILABLE";
        });

        const excludedGateways = eligibleGateways.filter(gw => !healthyEligibleGateways.includes(gw));

        // Step 2: Filter and sort rules (only ACTIVE, sorted by priority ASC)
        const activeRules = rules
            .filter(rule => rule.isActive())
            .sort((a, b) => a.priority - b.priority);

        // Step 3: Evaluate rules in priority order
        for (const rule of activeRules) {
            if (rule.matches(context, healthyEligibleGateways)) {
                const selectedGateway = rule.selectGateway(
                    context,
                    healthyEligibleGateways,
                    gatewayHealth as Map<string, string>
                );

                // Step 4: If rule selects unavailable gateway, ignore and continue
                if (selectedGateway) {
                    const selectedHealth = gatewayHealth.get(selectedGateway);
                    if (selectedHealth === "UNAVAILABLE") {
                        // Rule selected unavailable gateway, continue to next rule
                        continue;
                    }

                    // Rule successfully selected a gateway
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
                // Continue to next rule
            }
        }

        // Step 5: No rule selected - try fallback
        if (fallbackGatewayId) {
            const fallbackHealth = gatewayHealth.get(fallbackGatewayId);
            if (fallbackHealth && fallbackHealth !== "UNAVAILABLE") {
                return RoutingDecision.withFallback(
                    fallbackGatewayId,
                    "FALLBACK",
                    0,
                    "FALLBACK",
                    `Fallback gateway ${fallbackGatewayId} selected`,
                    context,
                    healthyEligibleGateways,
                    excludedGateways,
                    "No matching rule or all selected gateways unavailable"
                );
            }
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
