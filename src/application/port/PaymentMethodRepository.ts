import {PaymentMethod, PaymentMethodStatus,} from "../../domain/payment_method/PaymentMethod";
import {PaymentFlow} from "../../domain/payment_intent/PaymentIntent";
import {PaginatedResult} from "../shared/pagination/PaginatedResult";
import { IdentifierType } from "../../domain/payment_method_type/PaymentMethodType";

export interface PaymentMethodQuery {
    paymentFlow?: PaymentFlow;
    status?: PaymentMethodStatus;
    reusable?: boolean;
    sortBy?: "lastUsedAt" | "usageCount";
    sortOrder?: "ASC" | "DESC";
    pageSize: number;
    pageToken?: string;
}

export interface PaymentMethodRepository {
    save(paymentMethod: PaymentMethod): Promise<void>;

    findById(paymentMethodId: string): Promise<PaymentMethod | null>;

    findByUserAndFlow(
        userId: string,
        paymentFlow: PaymentFlow
    ): Promise<PaymentMethod[]>;

    findByIdentifier(
        identifierType: IdentifierType,
        normalizedValue: string
    ): Promise<PaymentMethod | null>;

    findByIdentityKey(identityKey: string): Promise<PaymentMethod | null>;

    listByUser(
        userId: string,
        query: PaymentMethodQuery
    ): Promise<PaginatedResult<PaymentMethod>>;

    incrementUsage(paymentMethodId: string, timestamp: Date): Promise<void>;
}
