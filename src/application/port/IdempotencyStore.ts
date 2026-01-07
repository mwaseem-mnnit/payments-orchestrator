/* 
 *   created by mohdwaseem
 *   created on 24/12/25 7:56pm
 *   To change this template use File | Settings | File and Code Templates.
*/

export interface IdempotencyStore {
    tryAcquire(key: string, ttlMs: number): Promise<boolean>;
}
