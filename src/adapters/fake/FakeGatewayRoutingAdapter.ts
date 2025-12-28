import { GatewayRoutingPort } from "../../application/port/GatewayRoutingPort";
import { PaymentMethod } from "../../domain/payment_intent/PaymentMethod";

export class FakeGatewayRoutingAdapter implements GatewayRoutingPort {
    private readonly defaultGateway = "FAKE_GATEWAY";

    async resolveGateway(_input: {
        paymentMethod: PaymentMethod;
        amount: number;
        currency: string;
        region?: string;
    }): Promise<string> {
        return this.defaultGateway;
    }
}

