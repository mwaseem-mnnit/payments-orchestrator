/* 
 *   created by mohdwaseem
 *   created on 08/01/26 1:34am
 *   To change this template use File | Settings | File and Code Templates.
*/

// domain/payment_gateway/PaymentGatewayRepository.ts

import { PaymentGateway } from "./PaymentGateway";

export interface PaymentGatewayRepository {
    /**
     * Returns all ENABLED gateways.
     * Must be deterministic and cache-backed internally.
     */
    findAllActive(): Promise<PaymentGateway[]>;

    /**
     * Finds a gateway by gatewayId.
     * Returns null if not found or DISABLED.
     */
    findById(gatewayId: string): Promise<PaymentGateway | null>;
}
