import { PaymentFlow, OperationType } from "../../domain/payment_intent/PaymentIntent";
import { GatewayHealthStatus } from "../../domain/routing/GatewayHealthStatus";

/**
 * Input DTO for gateway routing decisions.
 * Contains all canonical inputs that routing may consider.
 * 
 * Invariants:
 * - All required fields must be valid and non-null
 * - Routing metadata is read-only and cannot influence gateway behavior
 * - Must not contain gateway-specific runtime signals
 */
export class GatewayRoutingRequest {
    constructor(
        public readonly paymentFlow: PaymentFlow,
        public readonly operationType: OperationType,
        public readonly amount: number,
        public readonly currency: string,
        public readonly paymentMethodId?: string,
        public readonly paymentMethodType?: string,
        public readonly region?: string,
        public readonly payerReference?: string,
        public readonly payeeReference?: string,
        public readonly routingMetadata?: Record<string, unknown>
    ) {
        if (amount <= 0) {
            throw new Error("Amount must be greater than 0");
        }
        if (!currency || currency.trim().length === 0) {
            throw new Error("Currency must be specified");
        }
    }
}

/**
 * Output DTO for gateway routing decisions.
 * Contains the selected gateway and audit metadata.
 * 
 * Invariants:
 * - Either selectedGatewayId is set OR error is set (mutually exclusive)
 * - Decision is immutable once returned
 * - All audit fields are required for post-facto explanation
 */
export class GatewayRoutingResult {
    constructor(
        public readonly selectedGatewayId: string | null,
        public readonly appliedRuleId: string,
        public readonly appliedRuleVersion: number,
        public readonly fallbackApplied: boolean,
        public readonly routingTimestamp: Date,
        public readonly error?: GatewayRoutingError
    ) {
        // Invariant: Either gateway is selected OR error is present
        if (!selectedGatewayId && !error) {
            throw new Error("Either selectedGatewayId or error must be set");
        }
        if (selectedGatewayId && error) {
            throw new Error("Cannot have both selectedGatewayId and error");
        }
    }

    /**
     * Creates a successful routing result.
     */
    static success(
        selectedGatewayId: string,
        appliedRuleId: string,
        appliedRuleVersion: number,
        fallbackApplied: boolean,
        routingTimestamp: Date = new Date()
    ): GatewayRoutingResult {
        return new GatewayRoutingResult(
            selectedGatewayId,
            appliedRuleId,
            appliedRuleVersion,
            fallbackApplied,
            routingTimestamp
        );
    }

    /**
     * Creates a failed routing result.
     */
    static failure(
        error: GatewayRoutingError,
        routingTimestamp: Date = new Date()
    ): GatewayRoutingResult {
        return new GatewayRoutingResult(
            null,
            "NONE",
            0,
            false,
            routingTimestamp,
            error
        );
    }

    /**
     * Checks if routing was successful.
     */
    isSuccess(): boolean {
        return this.selectedGatewayId !== null && !this.error;
    }
}

/**
 * Error conditions for gateway routing failures.
 */
export enum GatewayRoutingErrorType {
    NO_ELIGIBLE_GATEWAY = "NO_ELIGIBLE_GATEWAY",
    INVALID_ROUTING_CONFIGURATION = "INVALID_ROUTING_CONFIGURATION",
    ROUTING_SERVICE_UNAVAILABLE = "ROUTING_SERVICE_UNAVAILABLE"
}

/**
 * Error representation for routing failures.
 */
export class GatewayRoutingError {
    constructor(
        public readonly errorType: GatewayRoutingErrorType,
        public readonly message: string,
        public readonly details?: Record<string, unknown>
    ) {}
}

/**
 * Port for gateway routing and selection.
 * 
 * This port provides gateway routing decisions based on canonical inputs.
 * Routing occurs exactly once per PaymentIntent and produces a deterministic result.
 * 
 * Responsibilities:
 * - Accept only canonical, gateway-agnostic inputs
 * - Delegate rule evaluation to routing domain
 * - Return deterministic, auditable routing decisions
 * - Never expose routing internals to callers
 * - Never allow adapters to influence routing
 * 
 * Invariants:
 * - Routing happens BEFORE any gateway interaction
 * - Routing result is immutable once returned
 * - Only one gateway is selected per request
 * - Routing decisions are auditable and explainable
 * 
 * Health status is provided as an INPUT SIGNAL only.
 * Health evaluation logic is external to this port.
 */
export interface GatewayRoutingPort {
    /**
     * Selects a gateway for the given routing request.
     * 
     * This method:
     * 1. Accepts canonical routing inputs
     * 2. Receives eligible gateways list (from eligibility filtering)
     * 3. Receives gateway health status map (as input signal)
     * 4. Delegates to routing domain for rule evaluation
     * 5. Returns deterministic routing decision with audit metadata
     * 
     * @param request Canonical routing request with payment context
     * @param eligibleGateways List of gateway IDs that passed eligibility filtering
     * @param gatewayHealth Map of gateway ID to health status (input signal only)
     * @returns GatewayRoutingResult with selected gateway and audit metadata
     * 
     * @throws GatewayRoutingError if routing cannot be completed
     * 
     * Guarantees:
     * - Deterministic: same inputs produce same output
     * - Immutable: result cannot be changed after return
     * - Auditable: includes rule ID, version, and explanation
     * - Single gateway: returns exactly one gateway ID or error
     */
    selectGateway(
        request: GatewayRoutingRequest,
        eligibleGateways: string[],
        gatewayHealth: Map<string, GatewayHealthStatus>
    ): Promise<GatewayRoutingResult>;
}
