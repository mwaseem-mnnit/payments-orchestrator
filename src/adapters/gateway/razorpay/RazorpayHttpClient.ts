import { HttpClient } from "../../../application/port/HttpClient";
import { HttpTransportError } from "../../../application/port/HttpTransportError";
import { Logger } from "../../../application/port/Logger";

interface RazorpayConfig {
    baseUrl: string;
    keyId: string;
    keySecret: string;
    timeoutMs: number;
}

interface RazorpayCreateOrderRequest {
    amount: number;
    currency: string;
    receipt?: string;
    notes?: Record<string, string>;
}

interface RazorpayCreateOrderResponse {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt?: string;
    status: string;
    attempts: number;
    created_at: number;
}

interface RazorpayFetchOrderResponse {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt?: string;
    status: string;
    attempts: number;
    created_at: number;
}

interface RazorpayCreatePayoutRequest {
    account_number: string;
    fund_account_id: string;
    amount: number;
    currency: string;
    mode?: string;
    purpose?: string;
    reference_id?: string;
    queue_if_low_balance?: boolean;
}

export interface RazorpayCreatePayoutResponse {
    id: string;
    entity: string;
    fund_account_id: string;
    amount: number;
    currency: string;
    fees: number;
    tax: number;
    status: string;
    utr?: string;
    mode: string;
    reference_id?: string;
    created_at: number;
}

interface RazorpayFetchPaymentResponse {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    status: string;
    order_id: string;
    invoice_id?: string;
    international: boolean;
    method: string;
    description?: string;
    created_at: number;
}

interface RazorpayCreateContactRequest {
    name: string;
    email?: string;
    contact?: string;
    type: string;
    reference_id?: string;
    notes?: Record<string, string>;
}

interface RazorpayCreateContactResponse {
    id: string;
    name: string;
    type: string;
}

interface RazorpayCreateFundAccountVpaRequest {
    contact_id: string;
    account_type: "vpa";
    vpa: {
        address: string;
    };
}

interface RazorpayCreateFundAccountBankRequest {
    contact_id: string;
    account_type: "bank_account";
    bank_account: {
        name: string;
        ifsc: string;
        account_number: string;
    };
}

type RazorpayCreateFundAccountRequest =
    | RazorpayCreateFundAccountVpaRequest
    | RazorpayCreateFundAccountBankRequest;

interface RazorpayCreateFundAccountResponse {
    id: string;
    account_type: string;
}

export class RazorpayHttpClient {
    constructor(
        private readonly httpClient: HttpClient,
        private readonly logger: Logger,
        private readonly config: RazorpayConfig
    ) {}

    async createOrder(request: RazorpayCreateOrderRequest): Promise<RazorpayCreateOrderResponse> {
        try {
            const response = await this.httpClient.request<RazorpayCreateOrderResponse>({
                method: "POST",
                url: `${this.config.baseUrl}/v1/orders`,
                headers: this.buildHeaders(),
                body: request,
                timeoutMs: this.config.timeoutMs,
            });

            return response.body;
        } catch (error) {
            if (error instanceof HttpTransportError) {
                this.logger.error(
                    "Razorpay createOrder HTTP request failed",
                    error,
                    {
                        operation: "createOrder",
                    }
                );
                throw error;
            }

            this.logger.error(
                "Razorpay createOrder unexpected error",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "createOrder",
                }
            );
            throw error;
        }
    }

    async fetchOrder(orderId: string): Promise<RazorpayFetchOrderResponse> {
        try {
            const response = await this.httpClient.request<RazorpayFetchOrderResponse>({
                method: "GET",
                url: `${this.config.baseUrl}/v1/orders/${orderId}`,
                headers: this.buildHeaders(),
                timeoutMs: this.config.timeoutMs,
            });

            return response.body;
        } catch (error) {
            if (error instanceof HttpTransportError) {
                this.logger.error(
                    "Razorpay fetchOrder HTTP request failed",
                    error,
                    {
                        operation: "fetchOrder",
                        orderId,
                    }
                );
                throw error;
            }

            this.logger.error(
                "Razorpay fetchOrder unexpected error",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "fetchOrder",
                    orderId,
                }
            );
            throw error;
        }
    }

    async createPayout(request: RazorpayCreatePayoutRequest): Promise<RazorpayCreatePayoutResponse> {
        try {
            const response = await this.httpClient.request<RazorpayCreatePayoutResponse>({
                method: "POST",
                url: `${this.config.baseUrl}/v1/payouts`,
                headers: this.buildHeaders(),
                body: request,
                timeoutMs: this.config.timeoutMs,
            });

            return response.body;
        } catch (error) {
            if (error instanceof HttpTransportError) {
                this.logger.error(
                    "Razorpay createPayout HTTP request failed",
                    error,
                    {
                        operation: "createPayout",
                    }
                );
                throw error;
            }

            this.logger.error(
                "Razorpay createPayout unexpected error",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "createPayout",
                }
            );
            throw error;
        }
    }

    async fetchPayment(paymentId: string): Promise<RazorpayFetchPaymentResponse> {
        try {
            const response = await this.httpClient.request<RazorpayFetchPaymentResponse>({
                method: "GET",
                url: `${this.config.baseUrl}/v1/payments/${paymentId}`,
                headers: this.buildHeaders(),
                timeoutMs: this.config.timeoutMs,
            });

            return response.body;
        } catch (error) {
            if (error instanceof HttpTransportError) {
                this.logger.error(
                    "Razorpay fetchPayment HTTP request failed",
                    error,
                    {
                        operation: "fetchPayment",
                        paymentId,
                    }
                );
                throw error;
            }

            this.logger.error(
                "Razorpay fetchPayment unexpected error",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "fetchPayment",
                    paymentId,
                }
            );
            throw error;
        }
    }

    async fetchPayout(payoutId: string): Promise<RazorpayCreatePayoutResponse> {
        try {
            const response = await this.httpClient.request<RazorpayCreatePayoutResponse>({
                method: "GET",
                url: `${this.config.baseUrl}/v1/payouts/${payoutId}`,
                headers: this.buildHeaders(),
                timeoutMs: this.config.timeoutMs,
            });

            return response.body;
        } catch (error) {
            if (error instanceof HttpTransportError) {
                this.logger.error(
                    "Razorpay fetchPayout HTTP request failed",
                    error,
                    {
                        operation: "fetchPayout",
                        payoutId,
                    }
                );
                throw error;
            }

            this.logger.error(
                "Razorpay fetchPayout unexpected error",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "fetchPayout",
                    payoutId,
                }
            );
            throw error;
        }
    }

    async createContact(
        request: RazorpayCreateContactRequest
    ): Promise<RazorpayCreateContactResponse> {
        try {
            const response =
                await this.httpClient.request<RazorpayCreateContactResponse>({
                    method: "POST",
                    url: `${this.config.baseUrl}/v1/contacts`,
                    headers: this.buildHeaders(),
                    body: request,
                    timeoutMs: this.config.timeoutMs,
                });

            return response.body;
        } catch (error) {
            if (error instanceof HttpTransportError) {
                this.logger.error(
                    "Razorpay createContact HTTP request failed",
                    error,
                    {
                        operation: "createContact",
                    }
                );
                throw error;
            }

            this.logger.error(
                "Razorpay createContact unexpected error",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "createContact",
                }
            );
            throw error;
        }
    }

    async createFundAccount(
        request: RazorpayCreateFundAccountRequest
    ): Promise<RazorpayCreateFundAccountResponse> {
        try {
            const response =
                await this.httpClient.request<RazorpayCreateFundAccountResponse>({
                    method: "POST",
                    url: `${this.config.baseUrl}/v1/fund_accounts`,
                    headers: this.buildHeaders(),
                    body: request,
                    timeoutMs: this.config.timeoutMs,
                });

            return response.body;
        } catch (error) {
            if (error instanceof HttpTransportError) {
                this.logger.error(
                    "Razorpay createFundAccount HTTP request failed",
                    error,
                    {
                        operation: "createFundAccount",
                    }
                );
                throw error;
            }

            this.logger.error(
                "Razorpay createFundAccount unexpected error",
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "createFundAccount",
                }
            );
            throw error;
        }
    }

    private buildHeaders(): Record<string, string> {
        const credentials = Buffer.from(
            `${this.config.keyId}:${this.config.keySecret}`
        ).toString("base64");

        return {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/json",
        };
    }
}

