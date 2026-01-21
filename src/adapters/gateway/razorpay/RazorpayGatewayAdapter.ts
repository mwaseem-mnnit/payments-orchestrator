import {
    CreatePayinRequest,
    CreatePayinResponse,
    CreatePayoutRequest,
    CreatePayoutResponse,
    FetchPaymentStatusRequest,
    FetchPaymentStatusResponse,
    PaymentGatewayPort
} from "../../../application/port/PaymentGatewayPort";
import {Clock} from "../../../application/port/Clock";
import {GatewayRefRepository} from "../../../application/port/GatewayRefRepository";
import {IdGenerator} from "../../../application/port/IdGenerator";
import {GatewayRef} from "../../../domain/gateway_ref/GatewayRef";
import {IdentifierType} from "../../../domain/payment_method_type/PaymentMethodType";
import {RazorpayCreatePayoutResponse, RazorpayHttpClient} from "./RazorpayHttpClient";
import {PaymentIntent} from "../../../domain/payment_intent/PaymentIntent";

export class RazorpayGatewayAdapter implements PaymentGatewayPort {

    constructor(
        private readonly gatewayId: string,
        private readonly razorpayHttpClient: RazorpayHttpClient,
        private readonly gatewayRefRepository: GatewayRefRepository,
        private readonly idGenerator: IdGenerator,
        private readonly clock: Clock
    ) {}

    getGatewayId(): string {
        return this.gatewayId;
    }

    async createPayin(
        request: CreatePayinRequest
    ): Promise<CreatePayinResponse> {
        const paymentIntent = request.paymentIntent;

        // Step 1: Do NOT resolve or create GatewayRef for PAYIN (blueprint PAYIN section).
        // Step 2: Build Razorpay Order request using canonical payment data.
        const notes: Record<string, string> = {
            paymentIntentId: paymentIntent.paymentIntentId
        };
        if (paymentIntent.payerReference) {
            notes.payerReference = paymentIntent.payerReference;
        }
        if (paymentIntent.payeeReference) {
            notes.payeeReference = paymentIntent.payeeReference;
        }

        const orderResponse = await this.razorpayHttpClient.createOrder({
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            receipt: paymentIntent.transactionId,
            notes
        });

        // Step 3: Treat order_id as gatewayTransactionReference (blueprint PAYIN section).
        // Step 4: Return canonical CreatePayinResponse; do not mutate PaymentIntent.
        const rawGatewayResponse: Record<string, unknown> = {
            ...orderResponse
        };
        return new CreatePayinResponse(
            orderResponse.id,
            rawGatewayResponse
        );
    }

    async createPayout(
        request: CreatePayoutRequest
    ): Promise<CreatePayoutResponse> {
        const paymentIntent = request.paymentIntent;
        const paymentMethod = request.paymentMethod;
        const gatewayContext = request.context?.input;
        const gatewayId = "RAZORPAY";

        const existingGatewayRef = await this.resolveActiveGatewayRef(
            paymentMethod.paymentMethodId,
            gatewayId
        );
        if (existingGatewayRef) {
            // GatewayRef is reused because gateway-side entities are long-lived and idempotent.
            const payoutResponse = await this.executeRazorpayPayout(
                paymentIntent,
                existingGatewayRef.normalizedKey,
                gatewayContext
            );
            return this.buildCreatePayoutResponse(payoutResponse);
        }

        const identifiers = this.extractBeneficiaryIdentifiers(paymentMethod);
        const contactResponse = await this.createRazorpayContact(
            paymentIntent,
            paymentMethod,
            identifiers,
            gatewayContext
        );
        const fundAccountResponse = await this.createRazorpayFundAccount(
            paymentMethod,
            identifiers,
            contactResponse.id,
            gatewayContext
        );
        await this.createAndPersistGatewayRef(
            paymentMethod.paymentMethodId,
            gatewayId,
            fundAccountResponse.id,
            contactResponse.id
        );
        const payoutResponse = await this.executeRazorpayPayout(
            paymentIntent,
            fundAccountResponse.id,
            gatewayContext
        );
        return this.buildCreatePayoutResponse(payoutResponse);
    }

    async fetchPaymentStatus(
        _request: FetchPaymentStatusRequest
    ): Promise<FetchPaymentStatusResponse> {
        // TODO: Implement using authority/gateways/razorpay_gateway_adapter_blueprint_v1.md
        // TODO: Follow authority/gateway_adapter_contract.md
        throw new Error("Not implemented");
    }

    private async resolveActiveGatewayRef(
        paymentMethodId: string,
        gatewayId: string
    ): Promise<GatewayRef | null> {
        return this.gatewayRefRepository.findByPaymentMethodAndGateway(
            paymentMethodId,
            gatewayId
        );
    }

    private extractBeneficiaryIdentifiers(
        paymentMethod: { identifiers: { identifierType: IdentifierType; identifierValue: string }[] }
    ): {
        vpa?: string;
        bankAccount?: string;
        ifsc?: string;
        email?: string;
        mobile?: string;
    } {
        // Identity derivation happens only once to prevent re-deriving and duplicating gateway entities.
        const identifierMap = new Map<IdentifierType, string>();
        for (const identifier of paymentMethod.identifiers) {
            identifierMap.set(identifier.identifierType, identifier.identifierValue);
        }

        return {
            vpa: identifierMap.get("UPI_VPA"),
            bankAccount: identifierMap.get("BANK_ACCOUNT"),
            ifsc: identifierMap.get("IFSC"),
            email: identifierMap.get("EMAIL"),
            mobile: identifierMap.get("MOBILE")
        };
    }

    private async createRazorpayContact(
        paymentIntent: { payeeReference?: string },
        paymentMethod: { userIdentifier: string },
        identifiers: {
            email?: string;
            mobile?: string;
        },
        gatewayContext?: Record<string, unknown>
    ): Promise<{ id: string }> {
        const contextName = this.readContextString(gatewayContext, "name");
        const contextEmail = this.readContextString(gatewayContext, "email");
        const contextPhone = this.readContextString(gatewayContext, "phone");

        return this.razorpayHttpClient.createContact({
            name: contextName ?? paymentMethod.userIdentifier,
            email: identifiers.email ?? contextEmail,
            contact: identifiers.mobile ?? contextPhone,
            type: "customer",
            reference_id: paymentIntent.payeeReference ?? paymentMethod.userIdentifier
        });
    }

    private async createRazorpayFundAccount(
        paymentMethod: { userIdentifier: string },
        identifiers: {
            vpa?: string;
            bankAccount?: string;
            ifsc?: string;
        },
        contactId: string,
        gatewayContext?: Record<string, unknown>
    ): Promise<{ id: string }> {
        if (identifiers.vpa) {
            return this.razorpayHttpClient.createFundAccount({
                contact_id: contactId,
                account_type: "vpa",
                vpa: {
                    address: identifiers.vpa
                }
            });
        }

        if (identifiers.bankAccount && identifiers.ifsc) {
            const contextName = this.readContextString(gatewayContext, "name");
            return this.razorpayHttpClient.createFundAccount({
                contact_id: contactId,
                account_type: "bank_account",
                bank_account: {
                    name: contextName ?? paymentMethod.userIdentifier,
                    ifsc: identifiers.ifsc,
                    account_number: identifiers.bankAccount
                }
            });
        }

        throw new Error(
            "Missing required payout identifiers for Razorpay fund account creation"
        );
    }

    private async createAndPersistGatewayRef(
        paymentMethodId: string,
        gatewayId: string,
        fundAccountId: string,
        contactId: string
    ): Promise<void> {
        const now = this.clock.now();
        const gatewayRef = new GatewayRef(
            this.idGenerator.generate(),
            paymentMethodId,
            gatewayId,
            fundAccountId,
            {
                contact_id: contactId,
                referenceType: "FUND_ACCOUNT"
            },
            "ACTIVE",
            now,
            now
        );

        await this.gatewayRefRepository.save(gatewayRef);
    }

    private async executeRazorpayPayout(
        paymentIntent: PaymentIntent,
        fundAccountId: string,
        gatewayContext?: Record<string, unknown>
    ): Promise<RazorpayCreatePayoutResponse> {
        // Fund account is not revalidated to avoid extra gateway calls and to preserve idempotency.
        return await this.razorpayHttpClient.createPayout({
            account_number: paymentIntent.transactionId,
            fund_account_id: fundAccountId,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            mode: this.readContextString(gatewayContext, "mode"),
            purpose: this.readContextString(gatewayContext, "purpose"),
            reference_id: paymentIntent.transactionId
        });
    }

    private buildCreatePayoutResponse(payoutResponse: RazorpayCreatePayoutResponse): CreatePayoutResponse {
        const rawGatewayResponse: Record<string, unknown> = {
            ...payoutResponse
        };
        return new CreatePayoutResponse(payoutResponse.id, rawGatewayResponse);
    }

    private readContextString(
        gatewayContext: Record<string, unknown> | undefined,
        key: string
    ): string | undefined {
        const value = gatewayContext?.[key];
        if (typeof value === "string") {
            return value;
        }
        return undefined;
    }
}
