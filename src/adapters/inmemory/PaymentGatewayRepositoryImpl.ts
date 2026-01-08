import { PaymentGateway } from "../../domain/gateway/PaymentGateway";
import { PaymentGatewayRepository } from "../../domain/gateway/PaymentGatewayRepository";
import { SnapshotStore } from "../../application/shared/snapshot/SnapshotStore";

/**
 * Repository implementation for PaymentGateway that reads from SnapshotStore.
 * 
 * This adapter:
 * - Reads ONLY from SnapshotStore (no loading or refresh logic)
 * - Applies ENABLED status filtering
 * - Provides deterministic reads
 * - Performs no I/O operations
 * 
 * Invariants:
 * - No JSON, DB, or S3 logic
 * - No caching logic (SnapshotStore handles that)
 * - Deterministic reads only
 * - Returns only ENABLED payment gateways
 */
export class PaymentGatewayRepositoryImpl implements PaymentGatewayRepository {
    constructor(private readonly snapshotStore: SnapshotStore<PaymentGateway>) {
        if (!snapshotStore) {
            throw new Error("SnapshotStore must be provided");
        }
    }

    /**
     * Returns all ENABLED gateways.
     * 
     * Filters the snapshot to return only items with status === "ENABLED".
     * Must be deterministic and cache-backed internally (via SnapshotStore).
     * 
     * @returns Promise resolving to array of ENABLED PaymentGateways
     */
    async findAllActive(): Promise<PaymentGateway[]> {
        const allGateways = this.snapshotStore.getAll();
        return allGateways.filter((gateway) => gateway.status === "ENABLED");
    }

    /**
     * Finds a gateway by gatewayId.
     * 
     * Returns null if:
     * - The gateway is not found in the snapshot
     * - The gateway status is not "ENABLED"
     * 
     * @param gatewayId The unique identifier of the payment gateway
     * @returns Promise resolving to PaymentGateway if found and ENABLED, null otherwise
     */
    async findById(gatewayId: string): Promise<PaymentGateway | null> {
        if (!gatewayId || gatewayId.trim().length === 0) {
            return null;
        }

        const allGateways = this.snapshotStore.getAll();
        const foundGateway = allGateways.find(
            (gateway) => gateway.gatewayId === gatewayId
        );

        if (!foundGateway) {
            return null;
        }

        // Return null if DISABLED (as per interface contract)
        if (foundGateway.status !== "ENABLED") {
            return null;
        }

        return foundGateway;
    }
}
