import {IdempotencyStore} from "../../application/port/IdempotencyStore";

interface IdempotencyEntry {
    key: string;
    expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
    private readonly entries: Map<string, IdempotencyEntry> = new Map();

    async tryAcquire(key: string, ttlMs: number): Promise<boolean> {
        const now = Date.now();
        const existing = this.entries.get(key);

        // Check if key exists and is not expired
        if (existing) {
            if (existing.expiresAt > now) {
                // Key is still active, acquisition failed
                return false;
            }
            // Key expired, remove it and allow acquisition
            this.entries.delete(key);
        }

        // Acquire the key by storing it with expiration time
        const expiresAt = now + ttlMs;
        this.entries.set(key, {
            key,
            expiresAt,
        });

        return true;
    }

    clear(): void {
        this.entries.clear();
    }
}

