import {
    GatewayRoutingPort,
    GatewayRoutingRequest,
    GatewayRoutingResult,
    GatewayRoutingError,
    GatewayRoutingErrorType
} from "../../application/port/GatewayRoutingPort";
import { RoutingConfiguration } from "../../domain/routing/RoutingConfiguration";
import { RoutingContext } from "../../domain/routing/RoutingContext";
import { RoutingDecision } from "../../domain/routing/RoutingDecision";
import { GatewayHealthStatus } from "../../domain/routing/GatewayHealthStatus";
import { Clock } from "../../application/port/Clock";

/**
 * Adapter implementing GatewayRoutingPort.
 * 
 * This adapter:
 * - Delegates routing logic to RoutingConfiguration domain model
 * - Ensures deterministic, auditable routing decisions
 * - Converts between port DTOs and domain models
 * - Handles errors explicitly without silent degradation
 * 
 * Invariants:
 * - Routing is deterministic (same inputs → same output)
 * - Only one gateway is selected per request
 * - Routing decisions are immutable once returned
 * - No gateway adapters can influence routing
 */
export class GatewayRoutingAdapter implements GatewayRoutingPort {
    constructor(
        private readonly routingConfiguration: RoutingConfiguration,
        private readonly clock: Clock
    ) {
        if (!routingConfiguration) {
            throw new Error("RoutingConfiguration must be provided");
        }
        if (!clock) {
            throw new Error("Clock must be provided");
        }
    }

    /**
     * Selects a gateway for the given routing request.
     * 
     * This method:
     * 1. Converts GatewayRoutingRequest to RoutingContext
     * 2. Delegates to RoutingConfiguration.makeDecision()
     * 3. Converts RoutingDecision to GatewayRoutingResult
     * 4. Handles errors explicitly
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

            // Delegate to routing domain for decision
            const decision = this.routingConfiguration.makeDecision(
                routingContext,
                eligibleGateways,
                gatewayHealth
            );

            // Convert domain decision to port result
            return this.toRoutingResult(decision, routingTimestamp);
        } catch (error) {
            // Handle routing configuration errors
            if (error instanceof Error && error.message.includes("configuration")) {
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

