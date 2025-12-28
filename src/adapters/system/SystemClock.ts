import {Clock} from "../../application/port/Clock";

export class SystemClock implements Clock {
    now(): Date {
        return new Date();
    }
}

