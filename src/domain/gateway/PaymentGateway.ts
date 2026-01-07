/* 
 *   created by mohdwaseem
 *   created on 07/01/26 8:43pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import {PaymentFlow} from "../payment_intent/PaymentIntent";

export type PaymentGatewayStatus = "ENABLED" | "DISABLED";

export class PaymentGateway {
    constructor(
        public readonly gatewayId: string,                  // canonical ID
        public readonly displayName: string,
        public readonly status: PaymentGatewayStatus,
        public readonly supportedFlows: PaymentFlow[],      // PAYIN, PAYOUT
        public readonly supportedMethodTypes: string[],     // methodTypeIds
        public readonly regions: string[],                  // ISO region codes
        public readonly metadata: Record<string, unknown>   // icon, docs, etc.
    ) {}
}
