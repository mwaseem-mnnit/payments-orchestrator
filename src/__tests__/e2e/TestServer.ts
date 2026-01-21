import {ApplicationContainer} from "../../bootstrap/container";
import {HttpServer} from "../../adapters/http/HttpServer";

export class TestServer {
    private readonly container: ApplicationContainer;
    private readonly httpServer: HttpServer;
    private port: number;
    private baseUrl: string;

    constructor(port: number = 0) {
        this.port = port;
        this.container = new ApplicationContainer();
        this.httpServer = new HttpServer(
            this.container.payinService,
            this.container.makePayoutService,
            this.container.fetchTransactionStatusService,
            this.container.listTransactionsByUserService,
            this.container.fetchPaymentCapabilitiesService,
            this.container.webhookService,
            this.container.clock,
            this.container.idGenerator,
            this.container.logger
        );
        this.baseUrl = `http://localhost:${port}`;
    }

    async start(): Promise<void> {
        // Initialize snapshot refresh engines (load configuration data)
        await this.container.initialize();
        
        await this.httpServer.listen(this.port, "127.0.0.1");
        const address = this.httpServer.getInstance().server.address();
        if (address && typeof address === "object") {
            this.port = address.port;
            this.baseUrl = `http://127.0.0.1:${this.port}`;
        }
    }

    async stop(): Promise<void> {
        await this.httpServer.close();
    }

    resetState(): void {
        this.container.reset();
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getContainer(): ApplicationContainer {
        return this.container;
    }
}

