import { SnapshotStore } from "../../application/shared/snapshot/SnapshotStore";

/**
 * Generic in-memory implementation of SnapshotStore.
 * 
 * This adapter:
 * - Stores snapshots fully in memory
 * - Replaces snapshots atomically
 * - Always returns valid arrays (never null)
 * - Performs no I/O operations
 * 
 * Invariants:
 * - Snapshot replacement is atomic (no partial state exposure)
 * - Reads always return a valid array (initialized to empty array)
 * - Returns defensive copies to prevent external mutation
 * - Single-process assumption (no distributed synchronization)
 * 
 * Thread Safety:
 * - Single-process environment
 * - Array assignment in JavaScript is atomic
 * - No additional locking required
 */
export class InMemorySnapshotStore<T> implements SnapshotStore<T> {
    private snapshot: T[] = [];

    /**
     * Replace the entire in-memory snapshot atomically.
     * 
     * This method:
     * - Creates a new array copy of the provided items
     * - Replaces the internal snapshot in a single atomic operation
     * - Never exposes partial state
     * 
     * @param items The new snapshot items to store
     */
    replace(items: T[]): void {
        if (!Array.isArray(items)) {
            throw new Error("Items must be an array");
        }

        // Create a new array copy to prevent external mutation
        // Array assignment in JavaScript is atomic, ensuring no partial state exposure
        this.snapshot = [...items];
    }

    /**
     * Returns the current snapshot.
     * 
     * Guarantees:
     * - Always returns a valid array (never null or undefined)
     * - Returns a defensive copy to prevent external mutation
     * - Returns empty array if no snapshot has been loaded yet
     * 
     * @returns A copy of the current snapshot array
     */
    getAll(): T[] {
        // Return a defensive copy to prevent external mutation
        // Always returns a valid array (initialized to empty array)
        return [...this.snapshot];
    }

    /**
     * Clears the snapshot store (useful for testing).
     * 
     * Sets the internal snapshot to an empty array.
     */
    clear(): void {
        this.snapshot = [];
    }
}
