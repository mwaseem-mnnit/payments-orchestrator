import { Logger } from "../../application/port/Logger";
import { Clock } from "../../application/port/Clock";
import { requestContextStore } from "../../adapters/http/RequestContext";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogPayload {
    timestamp: string;
    level: LogLevel;
    message: string;
    service: string;
    environment: string;
    context?: Record<string, any>;
    errorName?: string;
    errorMessage?: string;
}

export class StdoutJsonLogger implements Logger {
    constructor(
        private readonly clock: Clock,
        private readonly service: string,
        private readonly environment: string
    ) {}

    error(
        message: string,
        error?: Error,
        metadata?: Record<string, any>
    ): void {
        try {
            const now = this.clock.now();
            const payload: LogPayload = {
                timestamp: now.toISOString(),
                level: "ERROR",
                message,
                service: this.service,
                environment: this.environment,
            };

            if (error) {
                payload.errorName = error.name;
                payload.errorMessage = error.message;
            }

            // Initialize context with RequestContext from RequestContextStore if exists
            const requestContext = requestContextStore.getContext();
            const context: Record<string, any> = {};

            if (requestContext) {
                context.correlationId = requestContext.correlationId;
                context.requestStartTime = requestContext.requestStartTime.toISOString();
            }

            // Shallow merge metadata into context if exists
            if (metadata) {
                Object.assign(context, metadata);
            }

            // Only add context field if there's any context data
            if (Object.keys(context).length > 0) {
                payload.context = context;
            }

            const jsonLine = JSON.stringify(payload);
            process.stdout.write(jsonLine + "\n");
        } catch (logError) {
            // Logger must not throw while logging
            // Silently fail to avoid breaking application flow
        }
    }
}

