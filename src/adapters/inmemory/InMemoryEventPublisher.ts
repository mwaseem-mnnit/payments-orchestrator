import {EventPublisher} from "../../application/port/EventPublisher";
import {CanonicalEvent} from "../../domain/events/CanonicalEvent";

export class InMemoryEventPublisher implements EventPublisher {
    private readonly events: CanonicalEvent[] = [];

    async publish(event: CanonicalEvent): Promise<void> {
        this.events.push(event);
    }

    clear(): void {
        this.events.length = 0;
    }
}

