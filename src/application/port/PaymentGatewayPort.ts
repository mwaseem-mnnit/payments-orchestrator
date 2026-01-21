/*
 *   created by mohdwaseem
 *   created on 24/12/25 7:57 pm
 *   To change this template use File | Settings | File and Code Templates.
*/


import {PaymentIntent} from "../../domain/payment_intent/PaymentIntent";
import {PaymentMethod} from "../../domain/payment_method/PaymentMethod";

/**
 * Opaque context passed to gateway adapters.
 * Contents are interpreted ONLY by the adapter.
 * GatewayRef is adapter-internal
 * Webhook handling is part of the port
 * fetchPaymentStatus is non-mutating
 */
export class GatewayOperationContext {
    constructor(
        public readonly input?: Record<string, unknown>,
        public readonly headers?: Record<string, string>,
        public readonly metadata?: Record<string, unknown>
    ) {}
}

export interface PaymentGatewayPort {

    getGatewayId(): string;

    createPayin(
        request: CreatePayinRequest
    ): Promise<CreatePayinResponse>;

    createPayout(
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
        public readonly rawGatewayResponse?: Record<string, unknown>
    ) {}
}

export class CreatePayoutResponse {
    constructor(
        public readonly gatewayTransactionReference: string,
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
