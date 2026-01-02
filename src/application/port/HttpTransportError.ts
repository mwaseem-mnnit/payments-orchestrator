export class HttpTransportError extends Error {
    constructor(
        message: string,
        public readonly status: number | undefined,
        public readonly headers: Record<string, string>,
        public readonly body: unknown
    ) {
        super(message);
        this.name = "HttpTransportError";
    }
}

