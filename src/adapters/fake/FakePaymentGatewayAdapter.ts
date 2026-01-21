import {
    CreatePayinRequest,
    CreatePayinResponse,
    CreatePayoutRequest,
    CreatePayoutResponse,
    FetchPaymentStatusRequest,
    FetchPaymentStatusResponse,
    PaymentGatewayPort
} from "../../application/port/PaymentGatewayPort";

interface GatewayTransactionState {
    gatewayTransactionReference: string;
    status: string;
}

export class FakePaymentGatewayAdapter implements PaymentGatewayPort {
    private readonly transactions: Map<string, GatewayTransactionState>;
    private gatewayId: string = "FAKE_GATEWAY";
    private referenceCounter: number;


    constructor() {
        this.transactions = new Map();
        this.referenceCounter = 1;
    }

    getGatewayId(): string {
        return this.gatewayId;
    }

    async createPayin(
        _request: CreatePayinRequest
    ): Promise<CreatePayinResponse> {
        const gatewayTransactionReference = this.generateGatewayReference();
        const initialStatus = "PENDING";

        this.transactions.set(gatewayTransactionReference, {
            gatewayTransactionReference,
            status: initialStatus,
        });

        return new CreatePayinResponse(
            gatewayTransactionReference,
            {
                gatewayId: this.gatewayId,
                status: initialStatus,
            }
        );
    }

    async createPayout(
        _request: CreatePayoutRequest
    ): Promise<CreatePayoutResponse> {
        const gatewayTransactionReference = this.generateGatewayReference();
        const initialStatus = "PENDING";

        this.transactions.set(gatewayTransactionReference, {
            gatewayTransactionReference,
            status: initialStatus,
        });

        return new CreatePayoutResponse(
            gatewayTransactionReference,
            {
                gatewayId: this.gatewayId,
                status: initialStatus,
            }
        );
    }

    async fetchPaymentStatus(
        request: FetchPaymentStatusRequest
    ): Promise<FetchPaymentStatusResponse> {
        const state = this.transactions.get(
            request.gatewayTransactionReference
        );

        if (!state) {
            return new FetchPaymentStatusResponse(
                request.gatewayTransactionReference,
                "UNKNOWN"
            );
        }

        return new FetchPaymentStatusResponse(
            state.gatewayTransactionReference,
            state.status,
            {
                status: state.status,
            }
        );
    }

    private generateGatewayReference(): string {
        const reference = `fake_${this.gatewayId}_${this.referenceCounter}`;
        this.referenceCounter++;
        return reference;
    }

    clear(): void {
        this.transactions.clear();
        this.referenceCounter = 1;
    }
}

