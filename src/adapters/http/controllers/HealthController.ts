import { FastifyRequest, FastifyReply } from "fastify";

export class HealthController {
    async healthCheck(
        _request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        await reply.code(200).send({ status: "ok" });
    }
}

