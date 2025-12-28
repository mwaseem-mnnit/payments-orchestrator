/* 
 *   created by mohdwaseem
 *   created on 24/12/25 4:55pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import { PaymentIntent } from "../../domain/payment_intent/PaymentIntent";
import { PaymentFlowType, OperationType, PaymentIntentState } from "../../domain/payment_intent/PaymentIntent";

export interface TransactionQuery {
    userIdentifier: string;
    paymentFlowType?: PaymentFlowType;
    status?: PaymentIntentState;
    operationType?: OperationType;
    paymentMethod?: string;
    minAmount?: number;
    maxAmount?: number;
    fromDate?: Date;
    toDate?: Date;
    sortBy?: "createdAt" | "amount" | "updatedAt";
    sortOrder?: "ASC" | "DESC";
    pageSize: number;
    pageToken?: string;
}

export interface PaginatedResult<T> {
    items: T[];
    pageSize: number;
    pageToken?: string;
    nextPageToken?: string;
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
