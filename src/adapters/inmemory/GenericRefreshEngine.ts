import { RefreshEngine } from "../../application/shared/snapshot/RefreshEngine";
import { SnapshotLoader } from "../../application/shared/snapshot/SnapshotLoader";
import { SnapshotStore } from "../../application/shared/snapshot/SnapshotStore";
import { Logger } from "../../application/port/Logger";

/**
 * Generic refresh engine for managing snapshot loading and periodic refresh.
 * 
 * This component:
 * - Loads snapshot on startup via initialize()
 * - Manages periodic refresh at configured intervals
 * - Supports force refresh with single-flight semantics (coalesces concurrent calls)
 * - Handles refresh failures gracefully (keeps last good snapshot, logs errors)
 * 
 * Invariants:
 * - Only one refresh operation executes at a time
 * - Concurrent refresh calls are coalesced (single-flight)
 * - Periodic refresh failures do not throw (logged only)
 * - Last good snapshot is preserved on refresh failure
 * - No application logic
 */
export class GenericRefreshEngine<T> implements RefreshEngine {
    private refreshTimer: NodeJS.Timeout | null = null;
    private refreshInProgress: Promise<void> | null = null;
    private isPeriodicRefreshEnabled = false;

    constructor(
        private readonly loader: SnapshotLoader<T>,
        private readonly store: SnapshotStore<T>,
        private readonly refreshIntervalMs: number,
        private readonly logger: Logger
    ) {
        if (!loader) {
            throw new Error("SnapshotLoader must be provided");
        }
        if (!store) {
            throw new Error("SnapshotStore must be provided");
        }
        if (refreshIntervalMs <= 0) {
            throw new Error("Refresh interval must be greater than 0");
        }
        if (!logger) {
            throw new Error("Logger must be provided");
        }
    }

    /**
     * Load snapshot on startup.
     * 
     * This method performs a one-time load of the snapshot.
     * If loading fails, an error is thrown.
     * 
     * @throws Error if loading fails
     */
    async initialize(): Promise<void> {
        await this.performRefresh(true);
    }

    /**
     * Force an immediate refresh.
     * 
     * If a refresh is already in progress, this call will wait for that
     * refresh to complete (single-flight / coalescing behavior).
     * 
     * If the refresh fails, an error is thrown.
     * 
     * @throws Error if refresh fails
     */
    async forceRefresh(): Promise<void> {
        await this.performRefresh(true);
    }

    /**
     * Start periodic refresh using the configured interval.
     * 
     * If already started, this is a no-op.
     * Periodic refresh will continue until stop() is called.
     * 
     * Periodic refresh failures are logged but do not throw.
     */
    start(): void {
        if (this.isPeriodicRefreshEnabled) {
            return; // Already started
        }

        this.isPeriodicRefreshEnabled = true;
        this.scheduleNextRefresh();
    }

    /**
     * Stop periodic refresh.
     * 
     * This cancels any scheduled periodic refreshes.
     * In-progress refresh operations are not cancelled.
     * If already stopped, this is a no-op.
     */
    stop(): void {
        if (!this.isPeriodicRefreshEnabled) {
            return; // Already stopped
        }

        this.isPeriodicRefreshEnabled = false;
        if (this.refreshTimer !== null) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /**
     * Performs the actual refresh operation.
     * 
     * Implements single-flight semantics: if a refresh is already in progress,
     * concurrent calls will wait for the same refresh promise to complete.
     * 
     * @param throwOnError If true, throws on failure. If false, logs error only.
     */
    private async performRefresh(throwOnError: boolean): Promise<void> {
        // Single-flight: if refresh is already in progress, wait for it
        if (this.refreshInProgress !== null) {
            const inProgress = this.refreshInProgress;
            try {
                await inProgress;
                // Refresh succeeded, no need to throw
            } catch (error) {
                // Refresh failed: if caller wants to throw, re-throw the error
                // This ensures that forceRefresh() will throw even if waiting on
                // a periodic refresh that failed
                if (throwOnError) {
                    throw error;
                }
                // Otherwise, error is already logged by executeRefresh, just continue
            }
            return;
        }

        // Start a new refresh
        const refreshPromise = this.executeRefresh(throwOnError);
        this.refreshInProgress = refreshPromise;
        
        try {
            await refreshPromise;
        } finally {
            this.refreshInProgress = null;
        }
    }

    /**
     * Executes the actual refresh logic.
     * 
     * Always throws on failure, regardless of throwOnError parameter.
     * The throwOnError parameter is only used for logging context.
     * Callers are responsible for handling the error based on their context.
     * 
     * @param throwOnError Used for logging context only. This method always throws on error.
     */
    private async executeRefresh(throwOnError: boolean): Promise<void> {
        try {
            const items = await this.loader.loadAll();
            this.store.replace(items);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorObject = error instanceof Error ? error : new Error(String(error));

            this.logger.error(
                "Failed to refresh snapshot",
                errorObject,
                {
                    errorMessage,
                    throwOnError
                }
            );

            // On failure, we keep the last good snapshot (store is not modified)
            // Always throw so callers can decide whether to propagate or handle
            throw error;
        }
    }

    /**
     * Schedules the next periodic refresh.
     * 
     * This method schedules a refresh after refreshIntervalMs milliseconds.
     * After the refresh completes (successfully or not), it schedules the next one
     * if periodic refresh is still enabled.
     */
    private scheduleNextRefresh(): void {
        if (!this.isPeriodicRefreshEnabled) {
            return;
        }

        this.refreshTimer = setTimeout(async () => {
            // Perform refresh without throwing (periodic refresh should not crash)
            this.logger.error(
                "GenericRefreshEngine.scheduleNextRefresh: Performing periodic refresh",
                undefined,
                {

                }
            );
            await this.performRefresh(false);

            // Schedule next refresh if still enabled
            if (this.isPeriodicRefreshEnabled) {
                this.scheduleNextRefresh();
            }
        }, this.refreshIntervalMs);
    }
}
