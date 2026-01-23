import "dotenv/config";
import { HttpServer } from "../adapters/http/HttpServer";
import { ApplicationContainer } from "./container";
import { ProductionBindings } from "../application/bindings/ProductionBindings";

const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

const container = new ApplicationContainer(ProductionBindings.create());

const httpServer = new HttpServer(
    container.payinService,
    container.makePayoutService,
    container.fetchTransactionStatusService,
    container.listTransactionsByUserService,
    container.fetchPaymentCapabilitiesService,
    container.webhookService,
    container.clock,
    container.idGenerator,
    container.logger
);

async function start() {
    try {
        // Initialize snapshot refresh engines (load on startup, start periodic refresh)
        await container.initialize();
        
        await httpServer.listen(port, host);
        console.log(`Server listening on ${host}:${port}`);
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

start();

