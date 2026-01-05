import {SystemClock} from "../adapters/system/SystemClock";
import {UlidIdGenerator} from "../adapters/system/UlidIdGenerator";
import {InMemoryPaymentIntentRepository} from "../adapters/inmemory/InMemoryPaymentIntentRepository";
import {InMemoryPaymentMethodRepository} from "../adapters/inmemory/InMemoryPaymentMethodRepository";
import {InMemoryIdempotencyStore} from "../adapters/inmemory/InMemoryIdempotencyStore";
import {InMemoryEventPublisher} from "../adapters/inmemory/InMemoryEventPublisher";
import {FakePaymentGatewayAdapter} from "../adapters/fake/FakePaymentGatewayAdapter";
import {FakeGatewayRoutingAdapter} from "../adapters/fake/FakeGatewayRoutingAdapter";
import {StdoutJsonLogger} from "../adapters/logging/StdoutJsonLogger";
import {PayinService} from "../application/services/PayinService";
import {PayoutService} from "../application/services/PayoutService";
import {FetchTransactionStatusService} from "../application/services/FetchTransactionStatusService";
import {ListTransactionsByUserService} from "../application/services/ListTransactionsByUserService";
import {PaymentMethodService} from "../application/services/PaymentMethodService";
import {PaymentIntentService} from "../application/services/PaymentIntentService";

export class ApplicationContainer {
    readonly payinService: PayinService;
    readonly makePayoutService: PayoutService;
    readonly fetchTransactionStatusService: FetchTransactionStatusService;
    readonly listTransactionsByUserService: ListTransactionsByUserService;
    readonly clock: SystemClock;
    readonly idGenerator: UlidIdGenerator;

    private readonly paymentIntentRepository: InMemoryPaymentIntentRepository;
    private readonly paymentMethodRepository: InMemoryPaymentMethodRepository;
    private readonly idempotencyStore: InMemoryIdempotencyStore;
    private readonly eventPublisher: InMemoryEventPublisher;
    private readonly paymentGateway: FakePaymentGatewayAdapter;

    constructor() {
        // System Adapters
        this.clock = new SystemClock();
        this.idGenerator = new UlidIdGenerator();
        const logger = new StdoutJsonLogger(
            this.clock,
            "payments-orchestrator",
            process.env.NODE_ENV || "development"
        );

        // In-Memory Adapters
        this.paymentMethodRepository = new InMemoryPaymentMethodRepository();
        this.paymentIntentRepository = new InMemoryPaymentIntentRepository(
            this.paymentMethodRepository
        );
        this.idempotencyStore = new InMemoryIdempotencyStore();
        this.eventPublisher = new InMemoryEventPublisher();
        this.paymentGateway = new FakePaymentGatewayAdapter();
        const gatewayRouting = new FakeGatewayRoutingAdapter();

        // Application Services
        const paymentMethodService = new PaymentMethodService(
            this.paymentMethodRepository,
            this.idGenerator,
            logger
        );

        const paymentIntentService = new PaymentIntentService(
            this.paymentIntentRepository,
            this.idempotencyStore,
            this.idGenerator,
            this.clock,
            logger
        );

        this.payinService = new PayinService(
            paymentMethodService,
            paymentIntentService,
            gatewayRouting,
            this.paymentGateway,
            this.eventPublisher,
            this.clock,
            this.idGenerator,
            logger
        );

        this.makePayoutService = new PayoutService(
            paymentMethodService,
            paymentIntentService,
            gatewayRouting,
            this.paymentGateway,
            this.eventPublisher,
            this.clock,
            this.idGenerator,
            logger
        );

        this.fetchTransactionStatusService = new FetchTransactionStatusService(
            this.paymentIntentRepository,
            this.paymentMethodRepository
        );

        this.listTransactionsByUserService = new ListTransactionsByUserService(
            this.paymentIntentRepository,
            this.paymentMethodRepository
        );
    }

    reset(): void {
        this.paymentIntentRepository.clear();
        this.idempotencyStore.clear();
        this.eventPublisher.clear();
        this.paymentGateway.clear();
    }
}

