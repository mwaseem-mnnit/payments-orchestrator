import {IdGenerator} from "../../application/port/IdGenerator";

export class SequentialIdGenerator implements IdGenerator {
    private counter = 1;

    constructor(private readonly prefix: string = "test") {}

    generate(): string {
        const next = `${this.prefix}-${this.counter}`;
        this.counter += 1;
        return next;
    }
}
