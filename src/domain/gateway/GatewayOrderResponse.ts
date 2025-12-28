export class GatewayOrderResponse {
    constructor(
        public readonly gatewayTransactionReference: string,
        public readonly rawGatewayResponse?: Record<string, any>
    ) {}
}

