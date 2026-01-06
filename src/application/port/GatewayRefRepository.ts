/* 
 *   created by mohdwaseem
 *   created on 05/01/26 7:27pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import {GatewayRef} from "../../domain/gateway_ref/GatewayRef";

export interface GatewayRefRepository {
    findByPaymentMethodAndGateway(
        paymentMethodId: string,
        gatewayId: string
    ): Promise<GatewayRef | null>;

    save(gatewayRef: GatewayRef): Promise<void>;

    update(gatewayRef: GatewayRef): Promise<void>;
}
