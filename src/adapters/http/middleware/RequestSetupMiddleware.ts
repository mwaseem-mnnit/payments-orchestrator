import { FastifyRequest, FastifyReply } from "fastify";
import { Clock } from "../../../application/port/Clock";
import { IdGenerator } from "../../../application/port/IdGenerator";
import { RequestContext, requestContextStore } from "../RequestContext";

export class RequestSetupMiddleware {
    constructor(
        private readonly clock: Clock,
        private readonly idGenerator: IdGenerator
    ) {}

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

            requestContextStore.enterWith(context);
        };
    }
}

