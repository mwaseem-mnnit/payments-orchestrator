/* 
 *   created by mohdwaseem
 *   created on 09/01/26 3:41am
 *   To change this template use File | Settings | File and Code Templates.
*/


export interface SnapshotStore<T> {
    /**
     * Replace the entire in-memory snapshot atomically.
     */
    replace(items: T[]): void;

    /**
     * Returns the current snapshot.
     * Must never be null or partially loaded.
     */
    getAll(): T[];
}
