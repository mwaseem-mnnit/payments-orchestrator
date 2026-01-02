export interface Logger {
    error(message: string, error?: Error, metadata?: Record<string, any>): void;
}

