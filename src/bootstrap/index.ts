import { HttpServer } from "../adapters/http/HttpServer";
import { ApplicationContainer } from "./container";

const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

const container = new ApplicationContainer();

const httpServer = new HttpServer(
    container.createPaymentIntentService,
    container.makePayoutService,
    container.fetchTransactionStatusService,
    container.listTransactionsByUserService,
    container.clock,
    container.idGenerator
);

async function start() {
    try {
        await httpServer.listen(port, host);
        console.log(`Server listening on ${host}:${port}`);
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

start();

