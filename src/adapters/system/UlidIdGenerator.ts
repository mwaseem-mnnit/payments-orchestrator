import {IdGenerator} from "../../application/port/IdGenerator";
import {ulid} from "ulid";

export class UlidIdGenerator implements IdGenerator {
    generate(): string {
        return ulid();
    }
}

