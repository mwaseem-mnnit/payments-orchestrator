import { PaymentGatewayPort } from "../../../application/port/PaymentGatewayPort";
import { CreatePayinRequest } from "../../../application/port/gateway/dto/CreatePayinRequest";
import { CreatePayinResponse } from "../../../application/port/gateway/dto/CreatePayinResponse";
import { CreatePayoutRequest } from "../../../application/port/gateway/dto/CreatePayoutRequest";
import { CreatePayoutResponse } from "../../../application/port/gateway/dto/CreatePayoutResponse";
import { FetchPaymentStatusRequest } from "../../../application/port/gateway/dto/FetchPaymentStatusRequest";
import { FetchPaymentStatusResponse } from "../../../application/port/gateway/dto/FetchPaymentStatusResponse";
import { RazorpayHttpClient } from "./RazorpayHttpClient";
import { Logger } from "../../../application/port/Logger";
import { PaymentIntent } from "../../../domain/payment_intent/PaymentIntent";

export class RazorpayAdapter implements PaymentGatewayPort {
    constructor(
        private readonly razorpayHttpClient: RazorpayHttpClient,
        private readonly logger: Logger
    ) {}

    async createPayin(
        gatewayId: string,
        request: CreatePayinRequest
    ): Promise<CreatePayinResponse> {
        try {
            const razorpayRequest = {
                amount: request.paymentIntent.amount,
                currency: request.paymentIntent.currency,
                receipt: request.paymentIntent.transactionId,
                notes: this.buildNotes(request.paymentIntent),
            };

            const razorpayResponse = await this.razorpayHttpClient.createOrder(
                razorpayRequest
            );

            return new CreatePayinResponse(razorpayResponse.id, {
                id: razorpayResponse.id,
                amount: razorpayResponse.amount,
                currency: razorpayResponse.currency,
                status: razorpayResponse.status,
            });
        } catch (error) {
            this.logger.error(
                "Razorpay createPayin failed",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "createPayin",
                    gatewayId,
                }
            );
            throw error;
        }
    }

    async createPayout(
        gatewayId: string,
        request: CreatePayoutRequest
    ): Promise<CreatePayoutResponse> {
        try {
            const beneficiaryDetails = request.beneficiaryDetails || {};
            const payeeReference = request.paymentIntent.payeeReference || "";

            const contactId = await this.ensureContactExists(
                payeeReference,
                beneficiaryDetails
            );

            const fundAccountId = await this.ensureFundAccountExists(
                contactId,
                beneficiaryDetails
            );

            const razorpayRequest = {
                account_number: beneficiaryDetails.accountNumber || "",
                fund_account_id: fundAccountId,
                amount: request.paymentIntent.amount,
                currency: request.paymentIntent.currency,
                mode: beneficiaryDetails.mode || "UPI",
                purpose: beneficiaryDetails.purpose || "payout",
                reference_id: request.paymentIntent.transactionId,
                queue_if_low_balance: true,
            };

            const razorpayResponse = await this.razorpayHttpClient.createPayout(
                razorpayRequest
            );

            return new CreatePayoutResponse(razorpayResponse.id, {
                id: razorpayResponse.id,
                amount: razorpayResponse.amount,
                currency: razorpayResponse.currency,
                status: razorpayResponse.status,
                fund_account_id: razorpayResponse.fund_account_id,
            });
        } catch (error) {
            this.logger.error(
                "Razorpay createPayout failed",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "createPayout",
                    gatewayId,
                }
            );
            throw error;
        }
    }

    async fetchPaymentStatus(
        request: FetchPaymentStatusRequest
    ): Promise<FetchPaymentStatusResponse> {
        try {
            const reference = request.gatewayTransactionReference;

            if (reference.startsWith("pout_")) {
                return await this.fetchPayoutStatus(reference);
            } else if (reference.startsWith("pay_")) {
                return await this.fetchPayinPaymentStatus(reference);
            } else if (reference.startsWith("order_")) {
                return await this.fetchPayinOrderStatus(reference);
            } else {
                throw new Error(
                    `Unknown Razorpay reference format: ${reference}`
                );
            }
        } catch (error) {
            this.logger.error(
                "Razorpay fetchPaymentStatus failed",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "fetchPaymentStatus",
                    gatewayTransactionReference:
                        request.gatewayTransactionReference,
                }
            );
            throw error;
        }
    }

    private async fetchPayinPaymentStatus(
        paymentId: string
    ): Promise<FetchPaymentStatusResponse> {
        const razorpayResponse =
            await this.razorpayHttpClient.fetchPayment(paymentId);
        const status = this.mapPayinPaymentStatus(razorpayResponse.status);

        return new FetchPaymentStatusResponse(paymentId, status, {
            id: razorpayResponse.id,
            status: razorpayResponse.status,
            order_id: razorpayResponse.order_id,
            amount: razorpayResponse.amount,
            currency: razorpayResponse.currency,
        });
    }

    private async fetchPayinOrderStatus(
        orderId: string
    ): Promise<FetchPaymentStatusResponse> {
        const razorpayResponse =
            await this.razorpayHttpClient.fetchOrder(orderId);
        const status = this.mapPayinOrderStatus(razorpayResponse.status);

        return new FetchPaymentStatusResponse(orderId, status, {
            id: razorpayResponse.id,
            status: razorpayResponse.status,
            amount: razorpayResponse.amount,
            currency: razorpayResponse.currency,
        });
    }

    private async fetchPayoutStatus(
        payoutId: string
    ): Promise<FetchPaymentStatusResponse> {
        const razorpayResponse =
            await this.razorpayHttpClient.fetchPayout(payoutId);
        const status = this.mapPayoutStatus(razorpayResponse.status);

        return new FetchPaymentStatusResponse(payoutId, status, {
            id: razorpayResponse.id,
            status: razorpayResponse.status,
            amount: razorpayResponse.amount,
            currency: razorpayResponse.currency,
        });
    }

    private async ensureContactExists(
        payeeReference: string,
        beneficiaryDetails: Record<string, any>
    ): Promise<string> {
        const contactRequest = {
            name: beneficiaryDetails.name || payeeReference,
            email: beneficiaryDetails.email,
            contact: beneficiaryDetails.contact || beneficiaryDetails.phone,
            type: beneficiaryDetails.contactType || "vendor",
            reference_id: payeeReference,
        };

        const contactResponse =
            await this.razorpayHttpClient.createContact(contactRequest);
        return contactResponse.id;
    }

    private async ensureFundAccountExists(
        contactId: string,
        beneficiaryDetails: Record<string, any>
    ): Promise<string> {
        let fundAccountRequest;

        if (beneficiaryDetails.vpa || beneficiaryDetails.upiId) {
            fundAccountRequest = {
                contact_id: contactId,
                account_type: "vpa" as const,
                vpa: {
                    address: beneficiaryDetails.vpa || beneficiaryDetails.upiId,
                },
            };
        } else if (
            beneficiaryDetails.accountNumber &&
            beneficiaryDetails.ifsc
        ) {
            fundAccountRequest = {
                contact_id: contactId,
                account_type: "bank_account" as const,
                bank_account: {
                    name:
                        beneficiaryDetails.accountName ||
                        beneficiaryDetails.name,
                    ifsc: beneficiaryDetails.ifsc,
                    account_number: beneficiaryDetails.accountNumber,
                },
            };
        } else {
            throw new Error(
                "Fund account requires either VPA/UPI ID or account number + IFSC"
            );
        }

        const fundAccountResponse =
            await this.razorpayHttpClient.createFundAccount(fundAccountRequest);
        return fundAccountResponse.id;
    }

    private mapPayinPaymentStatus(razorpayStatus: string): string {
        switch (razorpayStatus) {
            case "created":
                return "GATEWAY_INITIATED";
            case "authorized":
                return "AUTHORIZED";
            case "captured":
                return "SUCCEEDED";
            case "failed":
                return "FAILED";
            default:
                return "PROCESSING";
        }
    }

    private mapPayinOrderStatus(razorpayStatus: string): string {
        switch (razorpayStatus) {
            case "created":
                return "GATEWAY_INITIATED";
            case "attempted":
                return "PROCESSING";
            case "paid":
                return "SUCCEEDED";
            default:
                return "PROCESSING";
        }
    }

    private mapPayoutStatus(razorpayStatus: string): string {
        switch (razorpayStatus) {
            case "queued":
                return "GATEWAY_INITIATED";
            case "processing":
                return "PROCESSING";
            case "processed":
                return "SUCCEEDED";
            case "failed":
                return "FAILED";
            case "cancelled":
                return "CANCELLED";
            default:
                return "PROCESSING";
        }
    }

    private buildNotes(paymentIntent: PaymentIntent): Record<string, string> {
        const notes: Record<string, string> = {};
        if (paymentIntent.payerReference) {
            notes.payerReference = paymentIntent.payerReference;
        }
        if (paymentIntent.payeeReference) {
            notes.payeeReference = paymentIntent.payeeReference;
        }
        if (paymentIntent.paymentIntentId) {
            notes.paymentIntentId = paymentIntent.paymentIntentId;
        }
        return notes;
    }
}

