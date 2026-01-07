/* 
 *   created by mohdwaseem
 *   created on 24/12/25 9:57pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import { CanonicalEvent } from "../../domain/events/CanonicalEvent";

export interface EventPublisher {
    publish(event: CanonicalEvent): Promise<void>;
}