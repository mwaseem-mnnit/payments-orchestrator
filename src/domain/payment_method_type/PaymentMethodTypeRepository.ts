/* 
 *   created by mohdwaseem
 *   created on 08/01/26 1:35am
 *   To change this template use File | Settings | File and Code Templates.
*/

// domain/payment_method_type/PaymentMethodTypeRepository.ts

import { PaymentMethodType } from "./PaymentMethodType";

export interface PaymentMethodTypeRepository {
    /**
     * Returns all ACTIVE payment method types.
     */
    findAllActive(): Promise<PaymentMethodType[]>;

    /**
     * Finds a payment method type by methodTypeId.
     * Returns null if not found or INACTIVE.
     */
    findById(methodTypeId: string): Promise<PaymentMethodType | null>;
}
