import { SystemClock } from "../adapters/system/SystemClock";
import { UlidIdGenerator } from "../adapters/system/UlidIdGenerator";
import { InMemoryPaymentIntentRepository } from "../adapters/inmemory/InMemoryPaymentIntentRepository";
import { InMemoryIdempotencyStore } from "../adapters/inmemory/InMemoryIdempotencyStore";
import { InMemoryEventPublisher } from "../adapters/inmemory/InMemoryEventPublisher";
import { FakePaymentGatewayAdapter } from "../adapters/fake/FakePaymentGatewayAdapter";
import { FakeGatewayRoutingAdapter } from "../adapters/fake/FakeGatewayRoutingAdapter";
import { CreatePaymentIntentService } from "../application/services/CreatePaymentIntentService";
import { MakePayoutService } from "../application/services/MakePayoutService";
import { FetchTransactionStatusService } from "../application/services/FetchTransactionStatusService";
import { ListTransactionsByUserService } from "../application/services/ListTransactionsByUserService";

export class ApplicationContainer {
    readonly createPaymentIntentService: CreatePaymentIntentService;
    readonly makePayoutService: MakePayoutService;
    readonly fetchTransactionStatusService: FetchTransactionStatusService;
    readonly listTransactionsByUserService: ListTransactionsByUserService;
    readonly clock: SystemClock;
    readonly idGenerator: UlidIdGenerator;

    private readonly paymentIntentRepository: InMemoryPaymentIntentRepository;
    private readonly idempotencyStore: InMemoryIdempotencyStore;
    private readonly eventPublisher: InMemoryEventPublisher;
    private readonly paymentGateway: FakePaymentGatewayAdapter;

    constructor() {
        // System Adapters
        this.clock = new SystemClock();
        this.idGenerator = new UlidIdGenerator();

        // In-Memory Adapters
        this.paymentIntentRepository = new InMemoryPaymentIntentRepository();
        this.idempotencyStore = new InMemoryIdempotencyStore();
        this.eventPublisher = new InMemoryEventPublisher();
        this.paymentGateway = new FakePaymentGatewayAdapter();
        const gatewayRouting = new FakeGatewayRoutingAdapter();

        // Application Services
        this.createPaymentIntentService = new CreatePaymentIntentService(
            this.paymentIntentRepository,
            this.idempotencyStore,
            gatewayRouting,
            this.paymentGateway,
            this.eventPublisher,
            this.clock,
            this.idGenerator
        );

        this.makePayoutService = new MakePayoutService(
            this.paymentIntentRepository,
            this.idempotencyStore,
            gatewayRouting,
            this.paymentGateway,
            this.eventPublisher,
            this.clock,
            this.idGenerator
        );

        this.fetchTransactionStatusService = new FetchTransactionStatusService(
            this.paymentIntentRepository
        );

        this.listTransactionsByUserService = new ListTransactionsByUserService(
            this.paymentIntentRepository
        );
    }

    reset(): void {
        this.paymentIntentRepository.clear();
        this.idempotencyStore.clear();
        this.eventPublisher.clear();
        this.paymentGateway.clear();
    }
}

