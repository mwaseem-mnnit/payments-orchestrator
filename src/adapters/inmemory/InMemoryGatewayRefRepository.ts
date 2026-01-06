import {GatewayRef} from "../../domain/gateway_ref/GatewayRef";
import {GatewayRefRepository} from "../../application/port/GatewayRefRepository";

export class InMemoryGatewayRefRepository implements GatewayRefRepository {
    private readonly byGatewayRefId: Map<string, GatewayRef> = new Map();
    private readonly byPaymentMethodAndGateway: Map<string, GatewayRef> = new Map();

    private buildLookupKey(paymentMethodId: string, gatewayId: string): string {
        return `${paymentMethodId}:${gatewayId}`;
    }

    async findByPaymentMethodAndGateway(
        paymentMethodId: string,
        gatewayId: string
    ): Promise<GatewayRef | null> {
        const key = this.buildLookupKey(paymentMethodId, gatewayId);
        const gatewayRef = this.byPaymentMethodAndGateway.get(key);
        
        if (!gatewayRef) {
            return null;
        }

        // Only return ACTIVE GatewayRef as per uniqueness guarantee
        if (gatewayRef.status === "ACTIVE") {
            return gatewayRef;
        }

        return null;
    }

    async save(gatewayRef: GatewayRef): Promise<void> {
        this.byGatewayRefId.set(gatewayRef.gatewayRefId, gatewayRef);
        
        const lookupKey = this.buildLookupKey(
            gatewayRef.paymentMethodId,
            gatewayRef.gatewayId
        );
        
        // Update lookup map - store only if ACTIVE, or if no ACTIVE exists
        const existing = this.byPaymentMethodAndGateway.get(lookupKey);
        if (!existing || existing.status !== "ACTIVE") {
            // If no existing or existing is not ACTIVE, update with new one if it's ACTIVE
            if (gatewayRef.status === "ACTIVE") {
                this.byPaymentMethodAndGateway.set(lookupKey, gatewayRef);
            }
        } else if (gatewayRef.status === "ACTIVE") {
            // If existing is ACTIVE and new one is also ACTIVE, replace it
            // This enforces uniqueness: only one ACTIVE per (paymentMethodId, gatewayId)
            this.byPaymentMethodAndGateway.set(lookupKey, gatewayRef);
        }
    }

    async update(gatewayRef: GatewayRef): Promise<void> {
        const existing = this.byGatewayRefId.get(gatewayRef.gatewayRefId);
        
        if (!existing) {
            // If not found, treat as save
            await this.save(gatewayRef);
            return;
        }

        // Update in primary map
        this.byGatewayRefId.set(gatewayRef.gatewayRefId, gatewayRef);

        const lookupKey = this.buildLookupKey(
            gatewayRef.paymentMethodId,
            gatewayRef.gatewayId
        );

        // Update lookup map based on status
        const existingLookup = this.byPaymentMethodAndGateway.get(lookupKey);
        
        if (gatewayRef.status === "ACTIVE") {
            // If updating to ACTIVE, ensure it's in the lookup map (enforces uniqueness)
            this.byPaymentMethodAndGateway.set(lookupKey, gatewayRef);
        } else {
            // If updating from ACTIVE to non-ACTIVE, remove from lookup if it's the same record
            if (existingLookup && existingLookup.gatewayRefId === gatewayRef.gatewayRefId) {
                this.byPaymentMethodAndGateway.delete(lookupKey);
            }
        }
    }

    clear(): void {
        this.byGatewayRefId.clear();
        this.byPaymentMethodAndGateway.clear();
    }
}

