import { PaymentMethodRepository } from "../port/PaymentMethodRepository";
import { PaymentMethod, PaymentMethodIdentifier } from "../../domain/payment_method/PaymentMethod";
import { PaymentFlow } from "../../domain/payment_intent/PaymentIntent";
import { IdGenerator } from "../port/IdGenerator";
import { Logger } from "../port/Logger";
import { PaymentMethodInput } from "../commands/PaymentCommand";
import { IdentifierType } from "../../domain/payment_method_type/PaymentMethodType";
import { PaymentMethodTypeRepository } from "../../domain/payment_method_type/PaymentMethodTypeRepository";

export interface ResolvePaymentMethodParams {
    paymentMethodId?: string;
    paymentMethodInput?: PaymentMethodInput;
    userIdentifier: string;
    paymentFlow: PaymentFlow;
}

export interface ValidatePaymentMethodParams {
    paymentMethodId?: string;
    paymentMethodInput?: PaymentMethodInput;
}

export class PaymentMethodService {
    constructor(
        private readonly paymentMethodRepository: PaymentMethodRepository,
        private readonly paymentMethodTypeRepository: PaymentMethodTypeRepository,
        private readonly idGenerator: IdGenerator,
        private readonly logger: Logger
    ) {
        if (!paymentMethodTypeRepository) {
            throw new Error("PaymentMethodTypeRepository must be provided");
        }
    }

    async validatePaymentMethodFields(
        params: ValidatePaymentMethodParams,
        paymentFlow: PaymentFlow
    ): Promise<void> {
        // Exactly one of paymentMethodId or paymentMethodInput must be provided
        const hasPaymentMethodId = !!params.paymentMethodId;
        const hasPaymentMethodInput = !!params.paymentMethodInput;

        if (!hasPaymentMethodId && !hasPaymentMethodInput) {
            throw new Error(
                "Either paymentMethodId or paymentMethodInput must be provided"
            );
        }

        if (hasPaymentMethodId && hasPaymentMethodInput) {
            throw new Error(
                "Cannot provide both paymentMethodId and paymentMethodInput"
            );
        }

        // Validate paymentMethodInput if provided
        if (params.paymentMethodInput) {
            await this.validatePaymentMethodInput(
                params.paymentMethodInput,
                paymentFlow
            );
        }

        // Validate paymentMethodId if provided
        if (params.paymentMethodId) {
            await this.validateExistingPaymentMethod(
                params.paymentMethodId,
                paymentFlow
            );
        }
    }

    /**
     * Validates paymentMethodInput against PaymentMethodType constraints.
     * 
     * Validates in order:
     * 1. PaymentMethodType exists and is ACTIVE
     * 2. paymentFlow is supported by the type
     * 3. All identifierTypes are allowed by the type
     * 
     * Fails fast with explicit errors.
     */
    private async validatePaymentMethodInput(
        paymentMethodInput: PaymentMethodInput,
        paymentFlow: PaymentFlow
    ): Promise<void> {
        if (
            !paymentMethodInput.methodTypeId ||
            paymentMethodInput.methodTypeId.trim() === ""
        ) {
            throw new Error("paymentMethodInput.methodTypeId is mandatory");
        }

        if (
            !paymentMethodInput.identifiers ||
            paymentMethodInput.identifiers.length === 0
        ) {
            throw new Error(
                "paymentMethodInput.identifiers must contain at least one identifier"
            );
        }

        // Load and validate PaymentMethodType FIRST (before normalizing identifiers)
        const methodType = await this.paymentMethodTypeRepository.findById(
            paymentMethodInput.methodTypeId
        );

        if (!methodType) {
            throw new Error(
                `PaymentMethodType not found: ${paymentMethodInput.methodTypeId}`
            );
        }

        if (methodType.status !== "ACTIVE") {
            throw new Error(
                `PaymentMethodType is not ACTIVE: ${paymentMethodInput.methodTypeId}, status: ${methodType.status}`
            );
        }

        // Validate paymentFlow is supported
        if (!methodType.supportedFlows.includes(paymentFlow)) {
            throw new Error(
                `PaymentMethodType ${paymentMethodInput.methodTypeId} does not support paymentFlow ${paymentFlow}. Supported flows: ${methodType.supportedFlows.join(", ")}`
            );
        }

        // Validate all identifierTypes are allowed
        for (const identifier of paymentMethodInput.identifiers) {
            if (
                !identifier.identifierType ||
                !identifier.identifierValue ||
                identifier.identifierValue.trim() === ""
            ) {
                throw new Error(
                    "Each identifier must have identifierType and identifierValue"
                );
            }

            if (!methodType.allowedIdentifierTypes.includes(identifier.identifierType)) {
                throw new Error(
                    `IdentifierType ${identifier.identifierType} is not allowed for PaymentMethodType ${paymentMethodInput.methodTypeId}. Allowed types: ${methodType.allowedIdentifierTypes.join(", ")}`
                );
            }
        }
    }

    /**
     * Validates existing PaymentMethod against PaymentMethodType constraints.
     * 
     * Validates:
     * 1. PaymentMethod exists
     * 2. PaymentMethodType exists and is ACTIVE
     * 3. paymentFlow is supported by the type
     * 4. All identifierTypes are still allowed by the type
     */
    private async validateExistingPaymentMethod(
        paymentMethodId: string,
        paymentFlow: PaymentFlow
    ): Promise<void> {
        const paymentMethod = await this.paymentMethodRepository.findById(
            paymentMethodId
        );

        if (!paymentMethod) {
            throw new Error(
                `PaymentMethod not found: ${paymentMethodId}`
            );
        }

        // Load and validate PaymentMethodType
        const methodType = await this.paymentMethodTypeRepository.findById(
            paymentMethod.methodTypeId
        );

        if (!methodType) {
            throw new Error(
                `PaymentMethodType not found for PaymentMethod ${paymentMethodId}: ${paymentMethod.methodTypeId}`
            );
        }

        if (methodType.status !== "ACTIVE") {
            throw new Error(
                `PaymentMethodType is not ACTIVE for PaymentMethod ${paymentMethodId}: ${paymentMethod.methodTypeId}, status: ${methodType.status}`
            );
        }

        // Validate paymentFlow is supported
        if (!methodType.supportedFlows.includes(paymentFlow)) {
            throw new Error(
                `PaymentMethodType ${paymentMethod.methodTypeId} does not support paymentFlow ${paymentFlow} for PaymentMethod ${paymentMethodId}. Supported flows: ${methodType.supportedFlows.join(", ")}`
            );
        }

        // Validate all identifierTypes are still allowed
        for (const identifier of paymentMethod.identifiers) {
            if (!methodType.allowedIdentifierTypes.includes(identifier.identifierType)) {
                throw new Error(
                    `PaymentMethod ${paymentMethodId} contains identifierType ${identifier.identifierType} which is no longer allowed for PaymentMethodType ${paymentMethod.methodTypeId}. Allowed types: ${methodType.allowedIdentifierTypes.join(", ")}`
                );
            }
        }
    }

    async getPaymentMethodById(
        paymentMethodId: string
    ): Promise<PaymentMethod> {
        const paymentMethod =
            await this.paymentMethodRepository.findById(paymentMethodId);

        if (!paymentMethod) {
            throw new Error(
                `PaymentMethod not found for paymentMethodId: ${paymentMethodId}`
            );
        }

        return paymentMethod;
    }

    async resolvePaymentMethod(
        params: ResolvePaymentMethodParams
    ): Promise<PaymentMethod> {
        if (params.paymentMethodId) {
            return await this.resolveExistingPaymentMethod(
                params.paymentMethodId,
                params.userIdentifier,
                params.paymentFlow
            );
        } else if (params.paymentMethodInput) {
            return await this.resolveNewPaymentMethod(
                params.paymentMethodInput,
                params.userIdentifier,
                params.paymentFlow
            );
        } else {
            throw new Error(
                "Either paymentMethodId or paymentMethodInput must be provided"
            );
        }
    }

    private async resolveExistingPaymentMethod(
        paymentMethodId: string,
        userId: string,
        paymentFlow: PaymentFlow
    ): Promise<PaymentMethod> {
        const paymentMethod =
            await this.paymentMethodRepository.findById(paymentMethodId);

        if (!paymentMethod) {
            throw new Error(
                `PaymentMethod not found for paymentMethodId: ${paymentMethodId}`
            );
        }

        // Validate userId matches
        if (paymentMethod.userIdentifier !== userId) {
            this.logger.error(
                "PaymentMethod userId mismatch",
                undefined,
                {
                    paymentMethodId,
                    expectedUserId: userId,
                    actualUserId: paymentMethod.userIdentifier
                }
            );
            throw new Error(
                `PaymentMethod userId does not match: expected ${userId}, got ${paymentMethod.userIdentifier}`
            );
        }

        // Validate paymentFlow matches
        if (paymentMethod.paymentFlow !== paymentFlow) {
            this.logger.error(
                "PaymentMethod paymentFlow mismatch",
                undefined,
                {
                    paymentMethodId,
                    expectedPaymentFlow: paymentFlow,
                    actualPaymentFlow: paymentMethod.paymentFlow
                }
            );
            throw new Error(
                `PaymentMethod paymentFlow must be ${paymentFlow}, got ${paymentMethod.paymentFlow}`
            );
        }

        // Validate status == ACTIVE
        if (paymentMethod.status !== "ACTIVE") {
            this.logger.error(
                "PaymentMethod status is not ACTIVE",
                undefined,
                {
                    paymentMethodId,
                    status: paymentMethod.status
                }
            );
            throw new Error(
                `PaymentMethod status must be ACTIVE, got ${paymentMethod.status}`
            );
        }

        // PaymentMethodType validation is already done in validatePaymentMethodFields

        return paymentMethod;
    }

    private async resolveNewPaymentMethod(
        paymentMethodInput: PaymentMethodInput,
        userIdentifier: string,
        paymentFlow: PaymentFlow
    ): Promise<PaymentMethod> {
        // PaymentMethodType validation is already done in validatePaymentMethodFields
        // It's safe to normalize identifiers since validation has already ensured
        // all identifierTypes are allowed by the PaymentMethodType

        // Normalize identifiers
        const normalizedIdentifiers = paymentMethodInput.identifiers.map(
            (input) => ({
                identifierType: input.identifierType,
                identifierValue: input.identifierValue,
                normalizedValue: this.normalizeIdentifier(
                    input.identifierType,
                    input.identifierValue
                ),
            })
        );

        // Lookup existing PaymentMethod by normalized identifiers
        for (const normalized of normalizedIdentifiers) {
            const existing = await this.paymentMethodRepository.findByIdentifier(
                normalized.identifierType,
                normalized.normalizedValue
            );

            if (existing) {
                // Validate it belongs to the same user and flow
                if (
                    existing.userIdentifier === userIdentifier &&
                    existing.paymentFlow === paymentFlow
                ) {
                    // Enhanced reuse validation: check all reuse conditions
                    if (await this.canReusePaymentMethod(existing, paymentFlow)) {
                        this.logger.error(
                            "Reusing existing PaymentMethod",
                            undefined,
                            {
                                paymentMethodId: existing.paymentMethodId,
                                identifierType: normalized.identifierType,
                                normalizedValue: normalized.normalizedValue
                            }
                        );
                        return existing;
                    }
                    // Cannot reuse - proceed to create new PaymentMethod
                }
            }
        }

        // Create new PaymentMethod
        const paymentMethodId = this.idGenerator.generate();

        const identifiers = normalizedIdentifiers.map(
            (normalized) =>
                new PaymentMethodIdentifier(
                    paymentMethodId,
                    normalized.identifierType,
                    normalized.identifierValue,
                    normalized.normalizedValue
                )
        );

        const newPaymentMethod = new PaymentMethod(
            paymentMethodId,
            userIdentifier,
            paymentFlow,
            paymentMethodInput.methodTypeId,
            paymentMethodInput.variant,
            "ACTIVE",
            true, // reusable
            0, // usageCount
            undefined, // lastUsedAt
            identifiers
        );

        await this.paymentMethodRepository.save(newPaymentMethod);

        this.logger.error(
            "Created new PaymentMethod",
            undefined,
            {
                paymentMethodId,
                methodTypeId: paymentMethodInput.methodTypeId
            }
        );

        return newPaymentMethod;
    }

    /**
     * Checks if an existing PaymentMethod can be reused.
     * 
     * Reuse is allowed ONLY if ALL conditions are met:
     * - status == ACTIVE
     * - reusable == true
     * - PaymentMethodType exists and is ACTIVE
     * - paymentFlow is supported by the type
     * - All identifierTypes are still allowed by the type
     * 
     * If any condition fails, reuse is NOT allowed.
     */
    private async canReusePaymentMethod(
        paymentMethod: PaymentMethod,
        paymentFlow: PaymentFlow
    ): Promise<boolean> {
        // Check status
        if (paymentMethod.status !== "ACTIVE") {
            return false;
        }

        // Check reusable flag
        if (!paymentMethod.reusable) {
            return false;
        }

        // Load PaymentMethodType
        const methodType = await this.paymentMethodTypeRepository.findById(
            paymentMethod.methodTypeId
        );

        if (!methodType || methodType.status !== "ACTIVE") {
            return false;
        }

        // Check paymentFlow is supported
        if (!methodType.supportedFlows.includes(paymentFlow)) {
            return false;
        }

        // Check all identifierTypes are still allowed
        for (const identifier of paymentMethod.identifiers) {
            if (!methodType.allowedIdentifierTypes.includes(identifier.identifierType)) {
                return false;
            }
        }

        return true;
    }

    private normalizeIdentifier(
        identifierType: IdentifierType,
        identifierValue: string
    ): string {
        // Basic normalization: lowercase and trim
        // More sophisticated normalization can be added per identifier type
        let normalized = identifierValue.trim().toLowerCase();

        switch (identifierType) {
            case "UPI_VPA":
                // UPI VPA: remove spaces, ensure @ symbol
                normalized = normalized.replace(/\s+/g, "");
                break;
            case "EMAIL":
                // Email: lowercase, trim
                normalized = normalized.trim().toLowerCase();
                break;
            case "MOBILE":
                // Mobile: remove spaces, dashes, parentheses
                normalized = normalized.replace(/[\s\-()]/g, "");
                break;
            case "BANK_ACCOUNT":
                // Bank account: remove spaces
                normalized = normalized.replace(/\s+/g, "");
                break;
            case "CARD_INSTRUMENT":
                // Card instrument: keep as-is (usually gateway-specific)
                break;
        }

        return normalized;
    }
}

