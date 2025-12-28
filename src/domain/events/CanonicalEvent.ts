export type EventSource = "SYSTEM" | "GATEWAY" | "RECONCILIATION" | "OPERATOR";

export type EventType =
    | "intent_created"
    | "intent_cancelled"
    | "intent_expired"
    | "gateway_initiated"
    | "gateway_success"
    | "gateway_failure"
    | "gateway_unknown"
    | "gateway_reversal"
    | "authorization_requested"
    | "authorization_success"
    | "authorization_failed"
    | "capture_requested"
    | "capture_success"
    | "capture_failed"
    | "reconciliation_success"
    | "reconciliation_failure"
    | "reconciliation_override";

export class CanonicalEvent {
    constructor(
        public readonly eventId: string,
        public readonly eventType: EventType,
        public readonly paymentIntentId: string,
        public readonly eventSource: EventSource,
        public readonly eventTimestamp: Date,
        public readonly receivedAt: Date,
        public readonly paymentFlowType?: string,
        public readonly operationType?: string,
        public readonly gateway?: string,
        public readonly gatewayTransactionReference?: string,
        public readonly success?: boolean,
        public readonly failureCategory?: string,
        public readonly failureReason?: string,
        public readonly rawGatewayStatus?: string,
        public readonly rawGatewayPayloadReference?: string,
        public readonly correlationId?: string
    ) {}
}

