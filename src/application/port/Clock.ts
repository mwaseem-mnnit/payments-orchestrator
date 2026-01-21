/* 
 *   created by mohdwaseem
 *   created on 24/12/25 8:48pm
 *   To change this template use File | Settings | File and Code Templates.
*/

export interface Clock {
    now(): Date;

    fromEpochMillis(epochMillis: number): Date;

    toEpochMillis(date: Date): number;

    fromIsoString(isoString: string): Date;
}
