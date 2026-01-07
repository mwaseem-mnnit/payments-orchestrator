import { AsyncLocalStorage } from "async_hooks";

export interface RequestContext {
    correlationId: string;
    requestStartTime: Date;
}

class RequestContextStore {
    private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

    getContext(): RequestContext | undefined {
        return this.asyncLocalStorage.getStore();
    }

    run<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
        return this.asyncLocalStorage.run(context, fn);
    }

    enterWith(context: RequestContext): void {
        this.asyncLocalStorage.enterWith(context);
    }
}

export const requestContextStore = new RequestContextStore();

