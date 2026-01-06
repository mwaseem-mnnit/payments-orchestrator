import {PaymentMethodRepository} from "../port/PaymentMethodRepository";
import {IdentifierType, PaymentMethod, PaymentMethodIdentifier} from "../../domain/payment_method/PaymentMethod";
import {PaymentFlow} from "../../domain/payment_intent/PaymentIntent";
import {IdGenerator} from "../port/IdGenerator";
import {Logger} from "../port/Logger";
import {PaymentMethodInput} from "../commands/PaymentCommand";

export interface ResolvePaymentMethodParams {
    paymentMethodId?: string;
    paymentMethodInput?: PaymentMethodInput;
    userIdentifier: string;
    paymentFlow: PaymentFlow;
    correlationId: string;
}

export interface ValidatePaymentMethodParams {
    paymentMethodId?: string;
    paymentMethodInput?: PaymentMethodInput;
}

export class PaymentMethodService {
    constructor(
        private readonly paymentMethodRepository: PaymentMethodRepository,
        private readonly idGenerator: IdGenerator,
        private readonly logger: Logger
    ) {}

    validatePaymentMethodFields(
        params: ValidatePaymentMethodParams
    ): void {
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
            if (
                !params.paymentMethodInput.methodTypeId ||
                params.paymentMethodInput.methodTypeId.trim() === ""
            ) {
                throw new Error("paymentMethodInput.methodTypeId is mandatory");
            }

            if (
                !params.paymentMethodInput.identifiers ||
                params.paymentMethodInput.identifiers.length === 0
            ) {
                throw new Error(
                    "paymentMethodInput.identifiers must contain at least one identifier"
                );
            }

            for (const identifier of params.paymentMethodInput.identifiers) {
                if (
                    !identifier.identifierType ||
                    !identifier.identifierValue ||
                    identifier.identifierValue.trim() === ""
                ) {
                    throw new Error(
                        "Each identifier must have identifierType and identifierValue"
                    );
                }
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
                params.paymentFlow,
                params.correlationId
            );
        } else if (params.paymentMethodInput) {
            return await this.resolveNewPaymentMethod(
                params.paymentMethodInput,
                params.userIdentifier,
                params.paymentFlow,
                params.correlationId
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
        paymentFlow: PaymentFlow,
        correlationId: string
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
                    actualUserId: paymentMethod.userIdentifier,
                    correlationId,
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
                    actualPaymentFlow: paymentMethod.paymentFlow,
                    correlationId,
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
                    status: paymentMethod.status,
                    correlationId,
                }
            );
            throw new Error(
                `PaymentMethod status must be ACTIVE, got ${paymentMethod.status}`
            );
        }

        return paymentMethod;
    }

    private async resolveNewPaymentMethod(
        paymentMethodInput: PaymentMethodInput,
        userIdentifier: string,
        paymentFlow: PaymentFlow,
        correlationId: string
    ): Promise<PaymentMethod> {
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
                    this.logger.error(
                        "Reusing existing PaymentMethod",
                        undefined,
                        {
                            paymentMethodId: existing.paymentMethodId,
                            identifierType: normalized.identifierType,
                            normalizedValue: normalized.normalizedValue,
                            correlationId,
                        }
                    );
                    return existing;
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
                methodTypeId: paymentMethodInput.methodTypeId,
                correlationId,
            }
        );

        return newPaymentMethod;
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

