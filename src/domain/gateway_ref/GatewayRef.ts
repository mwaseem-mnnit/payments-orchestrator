/* 
 *   created by mohdwaseem
 *   created on 05/01/26 7:26pm
 *   To change this template use File | Settings | File and Code Templates.
*/


export type GatewayRefStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export class GatewayRef {
    constructor(
        public readonly gatewayRefId: string,
        public readonly paymentMethodId: string,
        public readonly gatewayId: string,
        public readonly normalizedKey: string,
        public readonly metadata: Record<string, unknown>,
        public readonly status: GatewayRefStatus,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}
}
