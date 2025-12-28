/* 
 *   created by mohdwaseem
 *   created on 24/12/25 4:56 pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import { PaymentMethod } from "../../domain/payment_intent/PaymentMethod";

export interface GatewayRoutingPort {
    resolveGateway(input: {
        paymentMethod: PaymentMethod;
        amount: number;
        currency: string;
        region?: string;
    }): Promise<string>;
}
