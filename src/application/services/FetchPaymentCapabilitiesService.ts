import {PaymentMethodTypeRepository} from "../../domain/payment_method_type/PaymentMethodTypeRepository";
import {PaymentMethodRepository} from "../port/PaymentMethodRepository";
import {Logger} from "../port/Logger";
import {PaymentFlow} from "../../domain/payment_intent/PaymentIntent";
import {PaymentMethod, PaymentMethodStatus} from "../../domain/payment_method/PaymentMethod";
import {
    AvailablePaymentMethodTypeDto,
    ExistingPaymentMethodDto,
    FetchPaymentCapabilitiesResult,
    MaskedIdentifierDto
} from "../results/FetchPaymentCapabilitiesResult";
import {IdentifierMaskingUtils} from "./IdentifierMaskingUtils";
import {PaymentMethodType} from "../../domain/payment_method_type/PaymentMethodType";
import {Clock} from "../port/Clock";

/**
 * Service for fetching payment capabilities.
 * 
 * This service returns available payment method types and existing payment methods
 * for a given user and optional payment flow filter.
 * 
 * This API is descriptive only and does not trigger gateway calls or routing decisions.
 */
export class FetchPaymentCapabilitiesService {
    constructor(
        private readonly paymentMethodTypeRepository: PaymentMethodTypeRepository,
        private readonly paymentMethodRepository: PaymentMethodRepository,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {
        if (!paymentMethodTypeRepository) {
            throw new Error("PaymentMethodTypeRepository must be provided");
        }
        if (!paymentMethodRepository) {
            throw new Error("PaymentMethodRepository must be provided");
        }
        if (!logger) {
            throw new Error("Logger must be provided");
        }
    }

    /**
     * Fetches payment capabilities for a user.
     * 
     * @param userIdentifier The user identifier (required)
     * @param paymentFlow Optional payment flow filter (PAYIN | PAYOUT)
     * @param status Optional status filter (ACTIVE | INACTIVE), defaults to ACTIVE
     * @returns Promise resolving to payment capabilities result
     */
    async execute(
        userIdentifier: string,
        paymentFlow?: PaymentFlow,
        status?: PaymentMethodStatus
    ): Promise<FetchPaymentCapabilitiesResult> {
        if (!userIdentifier || userIdentifier.trim().length === 0) {
            throw new Error("userIdentifier is required");
        }

        // Step 1: Load PaymentMethodTypes
        const allTypes = await this.paymentMethodTypeRepository.findAllActive();
        let filteredTypes = allTypes;

        // Filter by paymentFlow if provided
        if (paymentFlow) {
            filteredTypes = allTypes.filter((type) =>
                type.supportedFlows.includes(paymentFlow)
            );
        }

        // Step 2: Map to availablePaymentMethodTypes DTO
        const availablePaymentMethodTypes: AvailablePaymentMethodTypeDto[] =
            filteredTypes.map((type) => this.mapPaymentMethodTypeToDto(type));

        // Step 3: Load existing PaymentMethods
        let paymentMethods;
        if (paymentFlow) {
            paymentMethods = await this.paymentMethodRepository.findByUserAndFlow(
                userIdentifier,
                paymentFlow
            );
        } else {
            // If no paymentFlow filter, fetch all payment methods for the user
            // Use listByUser with a large pageSize to get all results
            const result = await this.paymentMethodRepository.listByUser(userIdentifier, {
                pageSize: 1000, // Large page size to get all methods
                sortBy: "lastUsedAt",
                sortOrder: "DESC",
            });
            paymentMethods = result.items;
        }

        // Apply status filter (default to ACTIVE)
        const statusFilter = status || "ACTIVE";
        paymentMethods = paymentMethods.filter(
            (pm) => pm.status === statusFilter
        );

        // Step 4: Map to existingPaymentMethods DTO
        const existingPaymentMethods: ExistingPaymentMethodDto[] = paymentMethods
            .map((pm) => this.mapPaymentMethodToDto(pm))
            .sort((a, b) => {
                // Sort by lastUsedAt DESC (most recent first)
                if (!a.lastUsedAt && !b.lastUsedAt) {
                    return 0;
                }
                if (!a.lastUsedAt) {
                    return 1; // a comes after b
                }
                if (!b.lastUsedAt) {
                    return -1; // a comes before b
                }
                return this.clock.fromIsoString(b.lastUsedAt).getTime() - this.clock.fromIsoString(a.lastUsedAt).getTime();
            });

        return {
            availablePaymentMethodTypes,
            existingPaymentMethods,
        };
    }

    /**
     * Maps a PaymentMethodType to AvailablePaymentMethodTypeDto.
     */
    private mapPaymentMethodTypeToDto(
        type: PaymentMethodType
    ): AvailablePaymentMethodTypeDto {
        const icon = type.metadata?.icon as string | undefined;

        // Omit identityDefinition if identityRequirement is NONE
        const identityDefinition =
            type.identityRequirement === "NONE" ? undefined : type.identityDefinition;

        // Map inputRequirements from domain if present, otherwise empty array
        // Note: inputRequirements is optional in PaymentMethodType per authority
        const inputRequirements = (type as any).inputRequirements ?? [];

        return {
            methodTypeId: type.methodTypeId,
            displayName: type.displayName,
            icon,
            status: type.status,
            supportedPaymentFlows: type.supportedFlows,
            executionMode: type.executionMode,
            identityRequirement: type.identityRequirement,
            identityDefinition,
            allowedIdentifierTypes: type.allowedIdentifierTypes,
            inputRequirements,
            metadata: type.metadata,
        };
    }

    /**
     * Maps a PaymentMethod to ExistingPaymentMethodDto.
     */
    private mapPaymentMethodToDto(
        pm: PaymentMethod
    ): ExistingPaymentMethodDto {
        // Map identifiers to masked identifiers
        const maskedIdentifiers: MaskedIdentifierDto[] = pm.identifiers.map((id) => ({
            identifierType: id.identifierType,
            maskedValue: IdentifierMaskingUtils.maskIdentifier(
                id.identifierType,
                id.identifierValue
            ),
        }));

        return {
            paymentMethodId: pm.paymentMethodId,
            methodTypeId: pm.methodTypeId,
            variant: pm.variant,
            status: pm.status,
            reusable: pm.reusable,
            maskedIdentifiers,
            lastUsedAt: pm.lastUsedAt ? pm.lastUsedAt.toISOString() : undefined,
        };
    }
}
