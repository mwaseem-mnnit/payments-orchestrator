/* 
 *   created by mohdwaseem
 *   created on 09/01/26 3:41am
 *   To change this template use File | Settings | File and Code Templates.
*/

export interface RefreshEngine {
    /**
     * Load snapshot on startup.
     */
    initialize(): Promise<void>;

    /**
     * Force an immediate refresh.
     * Coalesced if already in progress.
     */
    forceRefresh(): Promise<void>;

    /**
     * Start periodic refresh (interval owned by implementation).
     */
    start(): void;

    /**
     * Stop periodic refresh.
     */
    stop(): void;
}
