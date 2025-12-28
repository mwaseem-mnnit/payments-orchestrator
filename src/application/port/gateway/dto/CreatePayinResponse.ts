export class CreatePayinResponse {
    constructor(
        public readonly gatewayTransactionReference: string,
        public readonly rawGatewayResponse?: Record<string, any>
    ) {}
}

