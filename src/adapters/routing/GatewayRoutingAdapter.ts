import {
    GatewayRoutingPort,
    GatewayRoutingRequest,
    GatewayRoutingResult,
    GatewayRoutingError,
    GatewayRoutingErrorType
} from "../../application/port/GatewayRoutingPort";
import { RoutingRuleRepository } from "../../domain/routing/RoutingRuleRepository";
import { RoutingRuleEvaluator } from "../../domain/routing/RoutingRuleEvaluator";
import { RoutingContext } from "../../domain/routing/RoutingContext";
import { RoutingDecision } from "../../domain/routing/RoutingDecision";
import { GatewayHealthStatus } from "../../domain/routing/GatewayHealthStatus";
import { Clock } from "../../application/port/Clock";

/**
 * Adapter implementing GatewayRoutingPort.
 * 
 * This adapter:
 * - Converts GatewayRoutingRequest to RoutingContext
 * - Loads routing rules via RoutingRuleRepository
 * - Delegates evaluation to RoutingRuleEvaluator
 * - Converts RoutingDecision to GatewayRoutingResult
 * - Handles errors explicitly without silent degradation
 * 
 * Invariants:
 * - Routing is deterministic (same inputs → same output)
 * - Only one gateway is selected per request
 * - Routing decisions are immutable once returned
 * - No gateway adapters can influence routing
 * - No state is stored (stateless adapter)
 */
export class GatewayRoutingAdapter implements GatewayRoutingPort {
    private readonly evaluator: RoutingRuleEvaluator;

    constructor(
        private readonly routingRuleRepository: RoutingRuleRepository,
        private readonly clock: Clock
    ) {
        if (!routingRuleRepository) {
            throw new Error("RoutingRuleRepository must be provided");
        }
        if (!clock) {
            throw new Error("Clock must be provided");
        }
        this.evaluator = new RoutingRuleEvaluator();
    }

    /**
     * Selects a gateway for the given routing request.
     * 
     * This method:
     * 1. Validates inputs
     * 2. Converts GatewayRoutingRequest to RoutingContext
     * 3. Loads active routing rules from repository
     * 4. Delegates to RoutingRuleEvaluator.evaluate()
     * 5. Converts RoutingDecision to GatewayRoutingResult
     * 6. Handles errors explicitly
     * 
     * Guarantees:
     * - Deterministic: same inputs produce same output
     * - Immutable: result cannot be changed after return
     * - Auditable: includes rule ID, version, and explanation
     * - Single gateway: returns exactly one gateway ID or error
     */
    async selectGateway(
        request: GatewayRoutingRequest,
        eligibleGateways: string[],
        gatewayHealth: Map<string, GatewayHealthStatus>
    ): Promise<GatewayRoutingResult> {
        const routingTimestamp = this.clock.now();

        try {
            // Validate inputs
            this.validateInputs(request, eligibleGateways, gatewayHealth);

            // Convert request to domain RoutingContext
            const routingContext = this.toRoutingContext(request);

            // Load active rules from repository
            const rules = await this.routingRuleRepository.findAllActive();

            // Delegate to evaluator for decision
            const decision = this.evaluator.evaluate(
                routingContext,
                rules,
                eligibleGateways,
                gatewayHealth
                // Note: fallbackGatewayId is not available from current interface
                // If needed, it should be added to GatewayRoutingPort interface in future
            );

            // Convert domain decision to port result
            return this.toRoutingResult(decision, routingTimestamp);
        } catch (error) {
            // Handle routing configuration errors
            if (error instanceof Error && error.message.includes("routing")) {
                return GatewayRoutingResult.failure(
                    new GatewayRoutingError(
                        GatewayRoutingErrorType.INVALID_ROUTING_CONFIGURATION,
                        error.message,
                        { request: this.sanitizeRequestForError(request) }
                    ),
                    routingTimestamp
                );
            }

            // Handle unexpected errors
            return GatewayRoutingResult.failure(
                new GatewayRoutingError(
                    GatewayRoutingErrorType.ROUTING_SERVICE_UNAVAILABLE,
                    "Routing service encountered an unexpected error",
                    { originalError: error instanceof Error ? error.message : String(error) }
                ),
                routingTimestamp
            );
        }
    }

    /**
     * Validates routing inputs.
     * 
     * Invariants:
     * - Eligible gateways list must not be empty (unless explicitly allowed)
     * - Gateway health map must be provided
     */
    private validateInputs(
        request: GatewayRoutingRequest,
        eligibleGateways: string[],
        gatewayHealth: Map<string, GatewayHealthStatus>
    ): void {
        if (!eligibleGateways || eligibleGateways.length === 0) {
            throw new Error("At least one eligible gateway must be provided");
        }

        if (!gatewayHealth) {
            throw new Error("Gateway health map must be provided");
        }

        // Validate that all eligible gateways have health status
        for (const gatewayId of eligibleGateways) {
            if (!gatewayHealth.has(gatewayId)) {
                throw new Error(`Health status missing for gateway: ${gatewayId}`);
            }
        }
    }

    /**
     * Converts GatewayRoutingRequest to domain RoutingContext.
     * 
     * This mapping ensures:
     * - All canonical inputs are preserved
     * - No gateway-specific data leaks into domain
     * - Context is immutable
     */
    private toRoutingContext(request: GatewayRoutingRequest): RoutingContext {
        return new RoutingContext(
            request.paymentFlow,
            request.operationType,
            request.amount,
            request.currency,
            request.region,
            request.payerReference,
            request.payeeReference,
            request.paymentMethodId,
            request.paymentMethodType
        );
    }

    /**
     * Converts domain RoutingDecision to port GatewayRoutingResult.
     * 
     * This mapping:
     * - Preserves all audit metadata
     * - Handles fallback scenarios
     * - Converts errors to explicit error results
     */
    private toRoutingResult(
        decision: RoutingDecision,
        routingTimestamp: Date
    ): GatewayRoutingResult {
        // If no gateway was selected, return error
        if (!decision.hasGateway()) {
            return GatewayRoutingResult.failure(
                new GatewayRoutingError(
                    GatewayRoutingErrorType.NO_ELIGIBLE_GATEWAY,
                    decision.explanation || "No eligible gateway available",
                    {
                        ruleId: decision.ruleId,
                        ruleVersion: decision.ruleVersion,
                        eligibleGateways: decision.eligibleGateways,
                        excludedGateways: decision.excludedGateways,
                        fallbackReason: decision.fallbackReason
                    }
                ),
                routingTimestamp
            );
        }

        // Success case: gateway was selected
        const fallbackApplied = decision.fallbackReason !== undefined && 
                                 decision.fallbackReason.length > 0;

        return GatewayRoutingResult.success(
            decision.selectedGateway!,
            decision.ruleId,
            decision.ruleVersion,
            fallbackApplied,
            routingTimestamp
        );
    }

    /**
     * Sanitizes request data for error reporting.
     * Removes sensitive or unnecessary fields.
     */
    private sanitizeRequestForError(request: GatewayRoutingRequest): Record<string, unknown> {
        return {
            paymentFlow: request.paymentFlow,
            operationType: request.operationType,
            amount: request.amount,
            currency: request.currency,
            region: request.region,
            paymentMethodType: request.paymentMethodType
            // Explicitly exclude: paymentMethodId, payerReference, payeeReference, routingMetadata
        };
    }
}

