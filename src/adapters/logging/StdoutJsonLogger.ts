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

    info(
        message: string,
        metadata?: Record<string, any>
    ): void {
        this.writeLog("INFO", message, undefined, metadata);
    }

    warn(
        message: string,
        metadata?: Record<string, any>
    ): void {
        this.writeLog("WARN", message, undefined, metadata);
    }

    error(
        message: string,
        error?: Error,
        metadata?: Record<string, any>
    ): void {
        this.writeLog("ERROR", message, error, metadata);
    }

    private writeLog(
        level: LogLevel,
        message: string,
        error?: Error,
        metadata?: Record<string, any>
    ): void {
        try {
            const now = this.clock.now();
            const payload: LogPayload = {
                timestamp: now.toISOString(),
                level: level,
                message,
                service: this.service,
                environment: this.environment,
            };

            if (error) {
                payload.errorName = error.name;
                payload.errorMessage = error.message;
            }

            const requestContext = requestContextStore.getContext();
            const context: Record<string, any> = {};

            if (requestContext) {
                context.correlationId = requestContext.correlationId;
                context.requestStartTime = requestContext.requestStartTime.toISOString();
            }

            if (metadata) {
                Object.assign(context, metadata);
            }

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

