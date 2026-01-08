import {PaymentFlow} from "../payment_intent/PaymentIntent";

/**
 * Input context for gateway eligibility evaluation.
 */
export interface PaymentMethodGatewayMappingContext {
    paymentFlow: PaymentFlow;
    methodTypeId: string;
    variant?: string;
    amount?: number;
    currency?: string;
    region?: string;
    customAttributes?: Record<string, unknown>;
}

/**
 * Output representing an eligible gateway with audit metadata.
 */
export interface EligibleGateway {
    gatewayId: string;
    appliedRuleId: string;
    ruleVersion: number;
}

/**
 * Port for PaymentMethod ↔ Gateway mapping service.
 * 
 * This service determines gateway eligibility based on mapping rules.
 * It does NOT perform routing, selection, or ranking.
 */
export interface PaymentMethodGatewayMappingService {
    /**
     * Determines which gateways are eligible for the given payment context.
     *
     * This method:
     * - Evaluates mapping rules by priority
     * - Applies dimension-based conditions
     * - Returns ONLY eligibility (no ranking or selection)
     *
     * @returns Set of eligible gateways with audit metadata
     */
    resolveEligibleGateways(
        context: PaymentMethodGatewayMappingContext
    ): Promise<Set<EligibleGateway>>;
}
