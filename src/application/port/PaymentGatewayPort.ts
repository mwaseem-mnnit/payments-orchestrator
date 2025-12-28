/* 
 *   created by mohdwaseem
 *   created on 24/12/25 4:57 pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import { CreatePayinRequest } from "./gateway/dto/CreatePayinRequest";
import { CreatePayinResponse } from "./gateway/dto/CreatePayinResponse";
import { CreatePayoutRequest } from "./gateway/dto/CreatePayoutRequest";
import { CreatePayoutResponse } from "./gateway/dto/CreatePayoutResponse";
import { FetchPaymentStatusRequest } from "./gateway/dto/FetchPaymentStatusRequest";
import { FetchPaymentStatusResponse } from "./gateway/dto/FetchPaymentStatusResponse";

export interface PaymentGatewayPort {
    createPayin(
        gatewayId: string,
        request: CreatePayinRequest
    ): Promise<CreatePayinResponse>;

    createPayout(
        gatewayId: string,
        request: CreatePayoutRequest
    ): Promise<CreatePayoutResponse>;

    fetchPaymentStatus(
        request: FetchPaymentStatusRequest
    ): Promise<FetchPaymentStatusResponse>;
}
