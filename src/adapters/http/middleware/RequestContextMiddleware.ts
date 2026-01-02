import { AsyncLocalStorage } from "async_hooks";
import { FastifyRequest, FastifyReply } from "fastify";
import { Clock } from "../../../application/port/Clock";
import { IdGenerator } from "../../../application/port/IdGenerator";

export interface RequestContext {
    correlationId: string;
    requestStartTime: Date;
}

export class RequestContextMiddleware {
    private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

    constructor(
        private readonly clock: Clock,
        private readonly idGenerator: IdGenerator
    ) {}

    getContext(): RequestContext | undefined {
        return this.asyncLocalStorage.getStore();
    }

    middleware() {
        return async (
            request: FastifyRequest,
            _reply: FastifyReply
        ): Promise<void> => {
            const headerCorrelationId = request.headers["x-correlation-id"] as
                | string
                | undefined;
            const correlationId = headerCorrelationId || this.idGenerator.generate();

            const context: RequestContext = {
                correlationId,
                requestStartTime: this.clock.now(),
            };

            this.asyncLocalStorage.enterWith(context);
        };
    }

    run<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
        return this.asyncLocalStorage.run(context, fn);
    }
}

