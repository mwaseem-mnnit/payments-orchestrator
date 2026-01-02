import { Logger } from "../../application/port/Logger";
import { Clock } from "../../application/port/Clock";

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

            if (metadata) {
                payload.context = { ...metadata };
            }

            const jsonLine = JSON.stringify(payload);
            process.stdout.write(jsonLine + "\n");
        } catch (logError) {
            // Logger must not throw while logging
            // Silently fail to avoid breaking application flow
        }
    }
}

