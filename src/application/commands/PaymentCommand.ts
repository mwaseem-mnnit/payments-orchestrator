import {IdentifierType} from "../../domain/payment_method/PaymentMethod";

export interface PaymentMethodIdentifierInput {
    identifierType: IdentifierType;
    identifierValue: string;
}

export interface PaymentMethodInput {
    methodTypeId: string;
    identifiers: PaymentMethodIdentifierInput[];
    variant?: string;
}

export abstract class PaymentCommand {
    constructor(
        public readonly transactionId: string,
        public readonly amount: number,
        public readonly userIdentifier: string,
        public readonly currency?: string,
        public readonly paymentMethodId?: string,
        public readonly paymentMethodInput?: PaymentMethodInput,
        public readonly preferredGateway?: string,
        public readonly gatewayContext?: Record<string, unknown>,
        public readonly additionalAttributes?: Record<string, unknown>
    ) {}
}

export class CreatePayinCommand extends PaymentCommand {
    constructor(
        transactionId: string,
        amount: number,
        userIdentifier: string,
        currency?: string,
        paymentMethodId?: string,
        paymentMethodInput?: PaymentMethodInput,
        preferredGateway?: string,
        gatewayContext?: Record<string, unknown>,
        additionalAttributes?: Record<string, unknown>
    ) {
        super(
            transactionId,
            amount,
            userIdentifier,
            currency,
            paymentMethodId,
            paymentMethodInput,
            preferredGateway,
            gatewayContext,
            additionalAttributes
        );
    }
}

export class CreatePayoutCommand extends PaymentCommand {
    constructor(
        transactionId: string,
        amount: number,
        userIdentifier: string,
        currency?: string,
        paymentMethodId?: string,
        paymentMethodInput?: PaymentMethodInput,
        preferredGateway?: string,
        gatewayContext?: Record<string, unknown>,
        additionalAttributes?: Record<string, unknown>
    ) {
        super(
            transactionId,
            amount,
            userIdentifier,
            currency,
            paymentMethodId,
            paymentMethodInput,
            preferredGateway,
            gatewayContext,
            additionalAttributes
        );
    }
}

