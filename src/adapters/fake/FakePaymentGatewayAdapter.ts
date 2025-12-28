import {PaymentGatewayPort} from "../../application/port/PaymentGatewayPort";
import {CreatePayinRequest} from "../../application/port/gateway/dto/CreatePayinRequest";
import {CreatePayinResponse} from "../../application/port/gateway/dto/CreatePayinResponse";
import {CreatePayoutRequest} from "../../application/port/gateway/dto/CreatePayoutRequest";
import {CreatePayoutResponse} from "../../application/port/gateway/dto/CreatePayoutResponse";
import {FetchPaymentStatusRequest} from "../../application/port/gateway/dto/FetchPaymentStatusRequest";
import {FetchPaymentStatusResponse} from "../../application/port/gateway/dto/FetchPaymentStatusResponse";

interface GatewayTransactionState {
    gatewayTransactionReference: string;
    status: string;
}

export class FakePaymentGatewayAdapter implements PaymentGatewayPort {
    private readonly transactions: Map<
        string,
        GatewayTransactionState
    > = new Map();
    private referenceCounter: number = 1;

    async createPayin(
        gatewayId: string,
        _request: CreatePayinRequest
    ): Promise<CreatePayinResponse> {
        const gatewayTransactionReference = this.generateGatewayReference(
            gatewayId
        );
        const initialStatus = "PENDING";

        this.transactions.set(gatewayTransactionReference, {
            gatewayTransactionReference,
            status: initialStatus,
        });

        return new CreatePayinResponse(gatewayTransactionReference, {
            gatewayId,
            status: initialStatus,
        });
    }

    async createPayout(
        gatewayId: string,
        _request: CreatePayoutRequest
    ): Promise<CreatePayoutResponse> {
        const gatewayTransactionReference = this.generateGatewayReference(
            gatewayId
        );
        const initialStatus = "PENDING";

        this.transactions.set(gatewayTransactionReference, {
            gatewayTransactionReference,
            status: initialStatus,
        });

        return new CreatePayoutResponse(gatewayTransactionReference, {
            gatewayId,
            status: initialStatus,
        });
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

    private generateGatewayReference(gatewayId: string): string {
        const reference = `fake_${gatewayId}_${this.referenceCounter}`;
        this.referenceCounter++;
        return reference;
    }

    clear(): void {
        this.transactions.clear();
        this.referenceCounter = 1;
    }
}

