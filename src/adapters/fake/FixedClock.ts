import {Clock} from "../../application/port/Clock";

export class FixedClock implements Clock {
    constructor(private readonly fixedEpochMillis: number = 0) {}

    now(): Date {
        return new Date(this.fixedEpochMillis);
    }

    fromEpochMillis(epochMillis: number): Date {
        return new Date(epochMillis);
    }

    toEpochMillis(date: Date): number {
        return date.getTime();
    }

    fromIsoString(isoString: string): Date {
        return new Date(isoString);
    }
}
