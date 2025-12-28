import { AsyncLocalStorage } from "async_hooks";
import { FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";

interface RequestContext {
    correlationId: string;
    requestStartTime: Date;
}

export class RequestContextMiddleware {
    private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

    getContext(): RequestContext | undefined {
        return this.asyncLocalStorage.getStore();
    }

    middleware() {
        return async (
            request: FastifyRequest,
            _reply: FastifyReply
        ): Promise<void> => {
            const correlationId =
                (request.headers["x-correlation-id"] as string) ||
                request.id ||
                randomUUID();

            const context: RequestContext = {
                correlationId,
                requestStartTime: new Date(),
            };

            this.asyncLocalStorage.enterWith(context);
        };
    }

    run<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
        return this.asyncLocalStorage.run(context, fn);
    }
}

