import { PaymentMethodType } from "../../domain/payment_method_type/PaymentMethodType";
import { PaymentMethodTypeRepository } from "../../domain/payment_method_type/PaymentMethodTypeRepository";
import { SnapshotStore } from "../../application/shared/snapshot/SnapshotStore";

/**
 * Repository implementation for PaymentMethodType that reads from SnapshotStore.
 * 
 * This adapter:
 * - Reads ONLY from SnapshotStore (no loading or refresh logic)
 * - Applies ACTIVE status filtering
 * - Provides deterministic reads
 * - Performs no I/O operations
 * 
 * Invariants:
 * - No JSON, DB, or S3 logic
 * - No caching logic (SnapshotStore handles that)
 * - Deterministic reads only
 * - Returns only ACTIVE payment method types
 */
export class PaymentMethodTypeRepositoryImpl implements PaymentMethodTypeRepository {
    constructor(private readonly snapshotStore: SnapshotStore<PaymentMethodType>) {
        if (!snapshotStore) {
            throw new Error("SnapshotStore must be provided");
        }
    }

    /**
     * Returns all ACTIVE payment method types.
     * 
     * Filters the snapshot to return only items with status === "ACTIVE".
     * 
     * @returns Promise resolving to array of ACTIVE PaymentMethodTypes
     */
    async findAllActive(): Promise<PaymentMethodType[]> {
        const allTypes = this.snapshotStore.getAll();
        return allTypes.filter((type) => type.status === "ACTIVE");
    }

    /**
     * Finds a payment method type by methodTypeId.
     * 
     * Returns null if:
     * - The type is not found in the snapshot
     * - The type status is not "ACTIVE"
     * 
     * @param methodTypeId The unique identifier of the payment method type
     * @returns Promise resolving to PaymentMethodType if found and ACTIVE, null otherwise
     */
    async findById(methodTypeId: string): Promise<PaymentMethodType | null> {
        if (!methodTypeId || methodTypeId.trim().length === 0) {
            return null;
        }

        const allTypes = this.snapshotStore.getAll();
        const foundType = allTypes.find(
            (type) => type.methodTypeId === methodTypeId
        );

        if (!foundType) {
            return null;
        }

        // Return null if INACTIVE (as per interface contract)
        if (foundType.status !== "ACTIVE") {
            return null;
        }

        return foundType;
    }
}
