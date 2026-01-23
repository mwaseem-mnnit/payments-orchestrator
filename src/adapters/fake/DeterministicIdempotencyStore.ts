import {IdempotencyStore} from "../../application/port/IdempotencyStore";
import {Clock} from "../../application/port/Clock";

interface IdempotencyEntry {
    key: string;
    expiresAt: number;
}

export class DeterministicIdempotencyStore implements IdempotencyStore {
    private readonly entries: Map<string, IdempotencyEntry> = new Map();

    constructor(private readonly clock: Clock) {}

    async tryAcquire(key: string, ttlMs: number): Promise<boolean> {
        const now = this.clock.toEpochMillis(this.clock.now());
        const existing = this.entries.get(key);

        if (existing) {
            if (existing.expiresAt > now) {
                return false;
            }
            this.entries.delete(key);
        }

        this.entries.set(key, {
            key,
            expiresAt: now + ttlMs,
        });

        return true;
    }

    clear(): void {
        this.entries.clear();
    }
}
