import { PaymentFlow } from "../../domain/payment_intent/PaymentIntent";
import { PaymentMethodTypeStatus, IdentityRequirement, IdentityDefinition, IdentifierType } from "../../domain/payment_method_type/PaymentMethodType";

/**
 * DTO for available payment method type in the capabilities response.
 */
export interface AvailablePaymentMethodTypeDto {
    methodTypeId: string;
    displayName: string;
    icon?: string;
    status: PaymentMethodTypeStatus;
    supportedPaymentFlows: PaymentFlow[];
    executionMode: "SDK_DRIVEN" | "BACKEND_DRIVEN";
    identityRequirement: IdentityRequirement;
    identityDefinition?: IdentityDefinition;
    allowedIdentifierTypes: IdentifierType[];
    inputRequirements: InputRequirementDto[];
    metadata: Record<string, unknown>;
}

/**
 * DTO for input requirement field.
 */
export interface InputRequirementFieldDto {
    fieldKey: string;
    dataType: string;
    required: boolean;
    constraints: Record<string, unknown>;
    maskStrategy?: string;
}

/**
 * DTO for input requirement scope.
 */
export interface InputRequirementDto {
    scope: "PAYMENT_METHOD" | "CUSTOMER" | "TRANSACTION";
    fields: InputRequirementFieldDto[];
}

/**
 * DTO for masked identifier in existing payment method.
 */
export interface MaskedIdentifierDto {
    identifierType: IdentifierType;
    maskedValue: string;
}

/**
 * DTO for existing payment method in the capabilities response.
 */
export interface ExistingPaymentMethodDto {
    paymentMethodId: string;
    methodTypeId: string;
    variant?: string;
    status: "ACTIVE" | "INACTIVE" | "INVALID";
    reusable: boolean;
    maskedIdentifiers: MaskedIdentifierDto[];
    lastUsedAt?: string; // ISO 8601 string
}

/**
 * Response DTO for FetchPaymentCapabilities API.
 */
export interface FetchPaymentCapabilitiesResult {
    availablePaymentMethodTypes: AvailablePaymentMethodTypeDto[];
    existingPaymentMethods: ExistingPaymentMethodDto[];
}
