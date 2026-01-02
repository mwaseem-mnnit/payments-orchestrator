import axios, { AxiosInstance, AxiosError, AxiosResponse } from "axios";
import { HttpClient, HttpRequest, HttpResponse } from "../../application/port/HttpClient";
import { HttpTransportError } from "../../application/port/HttpTransportError";
import { Logger } from "../../application/port/Logger";

export class AxiosHttpClient implements HttpClient {
    private readonly axiosInstance: AxiosInstance;

    constructor(
        private readonly logger: Logger,
        axiosInstance?: AxiosInstance
    ) {
        this.axiosInstance = axiosInstance || axios.create();
    }

    async request<T = unknown>(request: HttpRequest): Promise<HttpResponse<T>> {
        try {
            const axiosConfig = this.toAxiosConfig(request);
            const response: AxiosResponse<T> = await this.axiosInstance.request(axiosConfig);

            if (response.status < 200 || response.status >= 300) {
                const error = new HttpTransportError(
                    `HTTP request failed with status ${response.status}`,
                    response.status,
                    this.normalizeHeaders(response.headers),
                    response.data
                );
                this.logger.error(
                    "HTTP request failed with non-2xx status",
                    error,
                    {
                        url: request.url,
                        method: request.method,
                    }
                );
                throw error;
            }

            return {
                status: response.status,
                headers: this.normalizeHeaders(response.headers),
                body: response.data,
            };
        } catch (error) {
            if (error instanceof HttpTransportError) {
                throw error;
            }

            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<T>;
                const status = axiosError.response?.status;
                const headers = this.normalizeHeaders(
                    axiosError.response?.headers || {}
                );
                const body = axiosError.response?.data;

                const transportError = new HttpTransportError(
                    axiosError.message || "HTTP request failed",
                    status,
                    headers,
                    body
                );

                this.logger.error(
                    "HTTP request failed",
                    transportError,
                    {
                        url: request.url,
                        method: request.method,
                    }
                );

                throw transportError;
            }

            const unknownError = new HttpTransportError(
                error instanceof Error ? error.message : String(error),
                undefined,
                {},
                undefined
            );

            this.logger.error(
                "Unexpected HTTP request failure",
                unknownError,
                {
                    url: request.url,
                    method: request.method,
                }
            );

            throw unknownError;
        }
    }

    private toAxiosConfig(request: HttpRequest): {
        method: string;
        url: string;
        headers?: Record<string, string>;
        params?: Record<string, string | number | boolean>;
        data?: unknown;
        timeout?: number;
    } {
        const config: {
            method: string;
            url: string;
            headers?: Record<string, string>;
            params?: Record<string, string | number | boolean>;
            data?: unknown;
            timeout?: number;
        } = {
            method: request.method,
            url: request.url,
        };

        if (request.headers) {
            config.headers = request.headers;
        }

        if (request.queryParams) {
            config.params = request.queryParams;
        }

        if (request.body !== undefined) {
            config.data = request.body;
        }

        if (request.timeoutMs !== undefined) {
            config.timeout = request.timeoutMs;
        }

        return config;
    }

    private normalizeHeaders(
        headers: Record<string, any>
    ): Record<string, string> {
        const normalized: Record<string, string> = {};

        for (const [key, value] of Object.entries(headers)) {
            if (typeof value === "string") {
                normalized[key] = value;
            } else if (Array.isArray(value) && value.length > 0) {
                normalized[key] = String(value[0]);
            } else if (value !== undefined && value !== null) {
                normalized[key] = String(value);
            }
        }

        return normalized;
    }
}

