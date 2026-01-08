/* 
 *   created by mohdwaseem
 *   created on 09/01/26 3:40am
 *   To change this template use File | Settings | File and Code Templates.
*/

export interface SnapshotLoader<T> {
    /**
     * Loads the complete dataset as a snapshot.
     * Must return ALL items in canonical domain shape.
     */
    loadAll(): Promise<T[]>;
}
