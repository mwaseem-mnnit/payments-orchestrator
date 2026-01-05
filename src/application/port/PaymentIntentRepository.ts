/* 
 *   created by mohdwaseem
 *   created on 24/12/25 4:55pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import {OperationType, PaymentFlow, PaymentIntent, PaymentIntentState} from "../../domain/payment_intent/PaymentIntent";
import {PaginatedResult} from "../shared/pagination/PaginatedResult";

export interface PaymentMethodFilter {
    methodTypeId?: string;
    variant?: string;
    normalizedValues?: string[];
}

export interface TransactionQuery {
    userIdentifier: string;
    paymentFlowType?: PaymentFlow;
    status?: PaymentIntentState;
    operationType?: OperationType;
    paymentMethod?: PaymentMethodFilter;
    minAmount?: number;
    maxAmount?: number;
    fromDate?: Date;
    toDate?: Date;
    sortBy?: "createdAt" | "amount" | "updatedAt";
    sortOrder?: "ASC" | "DESC";
    pageSize: number;
    pageToken?: string;
}

export interface PaymentIntentRepository {
    findByTransactionId(
        transactionId: string
    ): Promise<PaymentIntent | null>;

    findByUserIdentifier(
        query: TransactionQuery
    ): Promise<PaginatedResult<PaymentIntent>>;

    create(paymentIntent: PaymentIntent): Promise<void>;

    update(paymentIntent: PaymentIntent): Promise<void>;
}
