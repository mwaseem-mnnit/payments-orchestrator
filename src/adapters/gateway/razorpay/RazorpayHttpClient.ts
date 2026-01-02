import { HttpClient } from "../../../application/port/HttpClient";
import { HttpTransportError } from "../../../application/port/HttpTransportError";
import { Logger } from "../../../application/port/Logger";

interface RazorpayConfig {
    baseUrl: string;
    keyId: string;
    keySecret: string;
    timeoutMs: number;
}

interface CreateOrderRequest {
    amount: number;
    currency: string;
    receipt?: string;
    notes?: Record<string, string>;
}

interface CreateOrderResponse {
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

interface FetchOrderResponse {
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

interface CreatePayoutRequest {
    account_number: string;
    fund_account_id: string;
    amount: number;
    currency: string;
    mode?: string;
    purpose?: string;
    reference_id?: string;
    queue_if_low_balance?: boolean;
}

interface CreatePayoutResponse {
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

interface FetchPaymentResponse {
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

interface CreateContactRequest {
    name: string;
    email?: string;
    contact?: string;
    type: string;
    reference_id?: string;
    notes?: Record<string, string>;
}

interface CreateContactResponse {
    id: string;
    name: string;
    type: string;
}

interface CreateFundAccountVpaRequest {
    contact_id: string;
    account_type: "vpa";
    vpa: {
        address: string;
    };
}

interface CreateFundAccountBankRequest {
    contact_id: string;
    account_type: "bank_account";
    bank_account: {
        name: string;
        ifsc: string;
        account_number: string;
    };
}

type CreateFundAccountRequest =
    | CreateFundAccountVpaRequest
    | CreateFundAccountBankRequest;

interface CreateFundAccountResponse {
    id: string;
    account_type: string;
}

export class RazorpayHttpClient {
    constructor(
        private readonly httpClient: HttpClient,
        private readonly logger: Logger,
        private readonly config: RazorpayConfig
    ) {}

    async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
        try {
            const response = await this.httpClient.request<CreateOrderResponse>({
                method: "POST",
                url: `${this.config.baseUrl}/orders`,
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

    async fetchOrder(orderId: string): Promise<FetchOrderResponse> {
        try {
            const response = await this.httpClient.request<FetchOrderResponse>({
                method: "GET",
                url: `${this.config.baseUrl}/orders/${orderId}`,
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

    async createPayout(request: CreatePayoutRequest): Promise<CreatePayoutResponse> {
        try {
            const response = await this.httpClient.request<CreatePayoutResponse>({
                method: "POST",
                url: `${this.config.baseUrl}/payouts`,
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

    async fetchPayment(paymentId: string): Promise<FetchPaymentResponse> {
        try {
            const response = await this.httpClient.request<FetchPaymentResponse>({
                method: "GET",
                url: `${this.config.baseUrl}/payments/${paymentId}`,
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

    async fetchPayout(payoutId: string): Promise<CreatePayoutResponse> {
        try {
            const response = await this.httpClient.request<CreatePayoutResponse>({
                method: "GET",
                url: `${this.config.baseUrl}/payouts/${payoutId}`,
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
        request: CreateContactRequest
    ): Promise<CreateContactResponse> {
        try {
            const response =
                await this.httpClient.request<CreateContactResponse>({
                    method: "POST",
                    url: `${this.config.baseUrl}/contacts`,
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
        request: CreateFundAccountRequest
    ): Promise<CreateFundAccountResponse> {
        try {
            const response =
                await this.httpClient.request<CreateFundAccountResponse>({
                    method: "POST",
                    url: `${this.config.baseUrl}/fund_accounts`,
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

