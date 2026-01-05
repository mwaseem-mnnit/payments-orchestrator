/*
 *   created by mohdwaseem
 *   created on 24/12/25 4:57 pm
 *   To change this template use File | Settings | File and Code Templates.
*/


import {PaymentIntent} from "../../domain/payment_intent/PaymentIntent";
import {PaymentMethod} from "../../domain/payment_intent/PaymentMethod";

/**
 * Opaque context passed to gateway adapters.
 * Contents are interpreted ONLY by the adapter.
 */
export class GatewayOperationContext {
    constructor(
        public readonly input?: Record<string, unknown>,
        public readonly headers?: Record<string, string>,
        public readonly metadata?: Record<string, unknown>
    ) {}
}

export interface PaymentGatewayPort {
    createPayin(
        gatewayId: string,
        request: CreatePayinRequest
    ): Promise<CreatePayinResponse>;

    createPayout(
        gatewayId: string,
        request: CreatePayoutRequest
    ): Promise<CreatePayoutResponse>;

    fetchPaymentStatus(
        request: FetchPaymentStatusRequest
    ): Promise<FetchPaymentStatusResponse>;
}

/* ---------- Requests ---------- */

export class CreatePayinRequest {
    constructor(
        public readonly paymentIntent: PaymentIntent,
        public readonly paymentMethod: PaymentMethod,
        public readonly context?: GatewayOperationContext
    ) {}
}

export class CreatePayoutRequest {
    constructor(
        public readonly paymentIntent: PaymentIntent,
        public readonly paymentMethod: PaymentMethod,
        public readonly context?: GatewayOperationContext
    ) {}
}

export class FetchPaymentStatusRequest {
    constructor(
        public readonly gatewayId: string,
        public readonly gatewayTransactionReference: string
    ) {}
}

/* ---------- Responses ---------- */

export class CreatePayinResponse {
    constructor(
        public readonly gatewayTransactionReference: string,
        public readonly updatedGatewayRefs?: Record<string, Record<string, string>>,
        public readonly rawGatewayResponse?: Record<string, unknown>
    ) {}
}

export class CreatePayoutResponse {
    constructor(
        public readonly gatewayTransactionReference: string,
        public readonly updatedGatewayRefs?: Record<string, Record<string, string>>,
        public readonly rawGatewayResponse?: Record<string, unknown>
    ) {}
}

export class FetchPaymentStatusResponse {
    constructor(
        public readonly gatewayTransactionReference: string,
        public readonly status: string,
        public readonly rawGatewayStatus?: Record<string, unknown>
    ) {}
}
