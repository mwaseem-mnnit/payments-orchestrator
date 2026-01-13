import { PaymentMethodRepository } from "../port/PaymentMethodRepository";
import { PaymentMethod, PaymentMethodIdentifier } from "../../domain/payment_method/PaymentMethod";
import { PaymentFlow } from "../../domain/payment_intent/PaymentIntent";
import { IdGenerator } from "../port/IdGenerator";
import { Logger } from "../port/Logger";
import { PaymentMethodInput } from "../commands/PaymentCommand";
import { IdentifierType, PaymentMethodType } from "../../domain/payment_method_type/PaymentMethodType";
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
    userIdentifier?: string;
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
                paymentFlow,
                params.userIdentifier!
            );
        }
    }

    /**
     * Validates paymentMethodInput against PaymentMethodType constraints.
     * 
     * Validates in order:
     * 1. PaymentMethodType exists and is ACTIVE
     * 2. paymentFlow is supported by the type
     * 3. identityRequirement is enforced:
     *    - NONE → identifiers MUST be empty or undefined
     *    - OPTIONAL → identifiers MAY be present
     *    - REQUIRED → identifiers MUST be present
     * 4. All identifierTypes are allowed by the type (only if identifiers are present)
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

        // Load and validate PaymentMethodType FIRST (before validating identifiers)
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

        // Enforce identityRequirement rules
        const hasIdentifiers = paymentMethodInput.identifiers && paymentMethodInput.identifiers.length > 0;

        if (methodType.identityRequirement === "NONE") {
            if (hasIdentifiers) {
                throw new Error(
                    `PaymentMethodType ${paymentMethodInput.methodTypeId} requires NO identifiers (identityRequirement: NONE), but identifiers were provided`
                );
            }
            // No identifiers needed - validation complete
            return;
        }

        if (methodType.identityRequirement === "REQUIRED") {
            if (!hasIdentifiers) {
                throw new Error(
                    `PaymentMethodType ${paymentMethodInput.methodTypeId} requires identifiers (identityRequirement: REQUIRED), but none were provided`
                );
            }
        }
        // OPTIONAL: identifiers may or may not be present

        // Validate identifierTypes are allowed (only if identifiers are present)
        if (hasIdentifiers) {
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
        paymentFlow: PaymentFlow,
        userIdentifier: string
    ): Promise<void> {
        const paymentMethod = await this.paymentMethodRepository.findById(
            paymentMethodId
        );

        if (!paymentMethod) {
            throw new Error(
                `PaymentMethod not found: ${paymentMethodId}`
            );
        }

        // Validate userId matches
        if (paymentMethod.userIdentifier !== userIdentifier) {
            this.logger.error(
                "PaymentMethod userIdentifier mismatch",
                undefined,
                {
                    paymentMethodId,
                    expectedUserId: userIdentifier,
                    actualUserId: paymentMethod.userIdentifier
                }
            );
            throw new Error(
                `PaymentMethod userId does not match: expected ${userIdentifier}, got ${paymentMethod.userIdentifier}`
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
        userIdentifier: string,
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
        if (paymentMethod.userIdentifier !== userIdentifier) {
            this.logger.error(
                "PaymentMethod userIdentifier mismatch",
                undefined,
                {
                    paymentMethodId,
                    expectedUserId: userIdentifier,
                    actualUserId: paymentMethod.userIdentifier
                }
            );
            throw new Error(
                `PaymentMethod userIdentifier does not match: expected ${userIdentifier}, got ${paymentMethod.userIdentifier}`
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
        // Load PaymentMethodType to compute identity
        const methodType = await this.paymentMethodTypeRepository.findById(
            paymentMethodInput.methodTypeId
        );

        if (!methodType) {
            throw new Error(
                `PaymentMethodType not found: ${paymentMethodInput.methodTypeId}`
            );
        }

        // Compute identityKey once
        const identityKey = this.computeIdentityKey(paymentMethodInput, methodType);

        // Lookup existing PaymentMethod by identityKey if defined
        if (identityKey) {
            const existing = await this.paymentMethodRepository.findByIdentityKey(identityKey);

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
                                identityKey: identityKey
                            }
                        );
                        return existing;
                    }
                    // Cannot reuse - proceed to create new PaymentMethod
                }
            }
        }

        // Normalize identifiers for storage (only if present)
        const normalizedIdentifiers = (paymentMethodInput.identifiers || []).map(
            (input) => ({
                identifierType: input.identifierType,
                identifierValue: input.identifierValue,
                normalizedValue: this.normalizeIdentifier(
                    input.identifierType,
                    input.identifierValue
                ),
            })
        );

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
            identityKey !== undefined, // reusable = true if identityKey is defined
            identityKey, // identityKey
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
                methodTypeId: paymentMethodInput.methodTypeId,
                identityKey: identityKey
            }
        );

        return newPaymentMethod;
    }

    /**
     * Checks if an existing PaymentMethod can be reused.
     * 
     * Reuse is allowed ONLY if ALL conditions are met:
     * - identityKey is defined (reuse requires identity)
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
        // Check identityKey is defined (reuse requires identity)
        if (!paymentMethod.identityKey) {
            return false;
        }

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

        // Check all identifierTypes are still allowed (if identifiers exist)
        for (const identifier of paymentMethod.identifiers) {
            if (!methodType.allowedIdentifierTypes.includes(identifier.identifierType)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Computes the identityKey for a PaymentMethod based on PaymentMethodType configuration.
     * 
     * Rules:
     * - If identityRequirement = NONE → return undefined
     * - If identityDefinition.type = DEFAULT:
     *   - Normalize identifier values
     *   - Use identifierTypes from identityDefinition if provided, else use all provided identifiers
     *   - Sort deterministically by identifierType
     *   - Format: <methodTypeId>:<normalizedValue1>|<normalizedValue2>|...
     * - If identityDefinition.type = CUSTOM:
     *   - return undefined (reuse disabled for now)
     * 
     * @param paymentMethodInput The payment method input
     * @param paymentMethodType The payment method type
     * @returns The computed identity key, or undefined if identity is not applicable
     */
    private computeIdentityKey(
        paymentMethodInput: PaymentMethodInput,
        paymentMethodType: PaymentMethodType
    ): string | undefined {
        // If identityRequirement is NONE, no identity key
        if (paymentMethodType.identityRequirement === "NONE") {
            return undefined;
        }

        // If identityDefinition is CUSTOM, return undefined (reuse disabled)
        if (paymentMethodType.identityDefinition.type === "CUSTOM") {
            return undefined;
        }

        // For DEFAULT identity definition
        if (paymentMethodType.identityDefinition.type === "DEFAULT") {
            const identifiers = paymentMethodInput.identifiers || [];

            // If no identifiers provided and REQUIRED, this should have been caught in validation
            // But if OPTIONAL and no identifiers, return undefined
            if (identifiers.length === 0) {
                return undefined;
            }

            // Determine which identifiers to use
            let identifiersToUse: typeof identifiers;
            if (paymentMethodType.identityDefinition?.identifierTypes?.length) {
                // Use only the specified identifierTypes
                identifiersToUse = identifiers.filter(id => 
                    paymentMethodType.identityDefinition.identifierTypes!.includes(id.identifierType)
                );
            } else {
                // Use all provided identifiers
                identifiersToUse = identifiers;
            }

            // If no matching identifiers after filtering, return undefined
            if (identifiersToUse.length === 0) {
                return undefined;
            }

            // Normalize and sort by identifierType for determinism
            const normalizedParts = identifiersToUse
                .map(id => ({
                    type: id.identifierType,
                    normalized: this.normalizeIdentifier(id.identifierType, id.identifierValue)
                }))
                .sort((a, b) => a.type.localeCompare(b.type))
                .map(part => part.normalized);

            // Format: <methodTypeId>:<normalizedValue1>|<normalizedValue2>|...
            return `${paymentMethodType.methodTypeId}:${normalizedParts.join("|")}`;
        }

        // Should not reach here, but return undefined for safety
        return undefined;
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

