export class FetchPaymentStatusResponse {
    constructor(
        public readonly gatewayTransactionReference: string,
        public readonly status: string,
        public readonly rawGatewayStatus?: Record<string, any>
    ) {}
}

