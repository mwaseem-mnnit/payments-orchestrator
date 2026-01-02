export interface HttpRequest {
    method: string;
    url: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string | number | boolean>;
    body?: unknown;
    timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
    status: number;
    headers: Record<string, string>;
    body: T;
}

export interface HttpClient {
    request<T = unknown>(request: HttpRequest): Promise<HttpResponse<T>>;
}

