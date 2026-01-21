import {Clock} from "../../application/port/Clock";

export class SystemClock implements Clock {
    now(): Date {
        return new Date();
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

