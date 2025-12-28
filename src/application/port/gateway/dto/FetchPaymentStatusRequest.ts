export class FetchPaymentStatusRequest {
    constructor(
        public readonly gatewayId: string,
        public readonly gatewayTransactionReference: string
    ) {}
}

