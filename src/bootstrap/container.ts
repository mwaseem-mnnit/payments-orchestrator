import {SystemClock} from "../adapters/system/SystemClock";
import {UlidIdGenerator} from "../adapters/system/UlidIdGenerator";
import {InMemoryPaymentIntentRepository} from "../adapters/inmemory/InMemoryPaymentIntentRepository";
import {InMemoryPaymentMethodRepository} from "../adapters/inmemory/InMemoryPaymentMethodRepository";
import {PaymentMethodTypeRepositoryImpl} from "../adapters/inmemory/PaymentMethodTypeRepositoryImpl";
import {PaymentGatewayRepositoryImpl} from "../adapters/inmemory/PaymentGatewayRepositoryImpl";
import {MappingRuleRepositoryImpl} from "../adapters/inmemory/MappingRuleRepositoryImpl";
import {RoutingRuleRepositoryImpl} from "../adapters/inmemory/RoutingRuleRepositoryImpl";
import {InMemorySnapshotStore} from "../adapters/inmemory/InMemorySnapshotStore";
import {GenericRefreshEngine} from "../adapters/inmemory/GenericRefreshEngine";
import {JsonPaymentMethodTypeSnapshotLoader} from "../adapters/snapshot/JsonPaymentMethodTypeSnapshotLoader";
import {JsonPaymentGatewaySnapshotLoader} from "../adapters/snapshot/JsonPaymentGatewaySnapshotLoader";
import {JsonMappingRuleSnapshotLoader} from "../adapters/snapshot/JsonMappingRuleSnapshotLoader";
import {JsonRoutingRuleSnapshotLoader} from "../adapters/snapshot/JsonRoutingRuleSnapshotLoader";
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
import {PaymentMethodGatewayMappingServiceImpl} from "../domain/payment_method_gateway_mapping/PaymentMethodGatewayMappingServiceImpl";
import {PaymentMethodType} from "../domain/payment_method_type/PaymentMethodType";
import {PaymentGateway} from "../domain/gateway/PaymentGateway";
import {MappingRule} from "../domain/payment_method_gateway_mapping/MappingRule";
import {RoutingRule} from "../domain/routing/RoutingRule";

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
    
    // Snapshot refresh engines (for lifecycle management)
    private readonly paymentMethodTypeRefreshEngine: GenericRefreshEngine<PaymentMethodType>;
    private readonly paymentGatewayRefreshEngine: GenericRefreshEngine<PaymentGateway>;
    private readonly mappingRuleRefreshEngine: GenericRefreshEngine<MappingRule>;
    private readonly routingRuleRefreshEngine: GenericRefreshEngine<RoutingRule>;

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
        
        // Snapshot Infrastructure for PaymentMethodType
        const paymentMethodTypeSnapshotStore = new InMemorySnapshotStore<PaymentMethodType>();
        const paymentMethodTypeSnapshotLoader = new JsonPaymentMethodTypeSnapshotLoader(
            process.env.PAYMENT_METHOD_TYPE_SNAPSHOT_FILE || "./data/payment-method-types.json"
        );
        const paymentMethodTypeRefreshIntervalMs = parseInt(
            process.env.PAYMENT_METHOD_TYPE_REFRESH_INTERVAL_MS || "300000",
            10
        );
        this.paymentMethodTypeRefreshEngine = new GenericRefreshEngine(
            paymentMethodTypeSnapshotLoader,
            paymentMethodTypeSnapshotStore,
            paymentMethodTypeRefreshIntervalMs,
            logger
        );
        const paymentMethodTypeRepository = new PaymentMethodTypeRepositoryImpl(
            paymentMethodTypeSnapshotStore
        );
        
        // Snapshot Infrastructure for PaymentGateway
        const paymentGatewaySnapshotStore = new InMemorySnapshotStore<PaymentGateway>();
        const paymentGatewaySnapshotLoader = new JsonPaymentGatewaySnapshotLoader(
            process.env.PAYMENT_GATEWAY_SNAPSHOT_FILE || "./data/payment-gateways.json"
        );
        const paymentGatewayRefreshIntervalMs = parseInt(
            process.env.PAYMENT_GATEWAY_REFRESH_INTERVAL_MS || "300000",
            10
        );
        this.paymentGatewayRefreshEngine = new GenericRefreshEngine(
            paymentGatewaySnapshotLoader,
            paymentGatewaySnapshotStore,
            paymentGatewayRefreshIntervalMs,
            logger
        );
        const paymentGatewayRepository = new PaymentGatewayRepositoryImpl(
            paymentGatewaySnapshotStore
        );
        
        // Snapshot Infrastructure for MappingRule
        const mappingRuleSnapshotStore = new InMemorySnapshotStore<MappingRule>();
        const mappingRuleSnapshotLoader = new JsonMappingRuleSnapshotLoader(
            process.env.MAPPING_RULE_SNAPSHOT_FILE || "./data/mapping-rule.json"
        );
        const mappingRuleRefreshIntervalMs = parseInt(
            process.env.MAPPING_RULE_REFRESH_INTERVAL_MS || "300000",
            10
        );
        this.mappingRuleRefreshEngine = new GenericRefreshEngine(
            mappingRuleSnapshotLoader,
            mappingRuleSnapshotStore,
            mappingRuleRefreshIntervalMs,
            logger
        );
        const mappingRuleRepository = new MappingRuleRepositoryImpl(
            mappingRuleSnapshotStore
        );
        
        // Snapshot Infrastructure for RoutingRule
        const routingRuleSnapshotStore = new InMemorySnapshotStore<RoutingRule>();
        const routingRuleSnapshotLoader = new JsonRoutingRuleSnapshotLoader(
            process.env.ROUTING_RULE_SNAPSHOT_FILE || "./data/routing-rules.json"
        );
        const routingRuleRefreshIntervalMs = parseInt(
            process.env.ROUTING_RULE_REFRESH_INTERVAL_MS || "300000",
            10
        );
        this.routingRuleRefreshEngine = new GenericRefreshEngine(
            routingRuleSnapshotLoader,
            routingRuleSnapshotStore,
            routingRuleRefreshIntervalMs,
            logger
        );
        const routingRuleRepository = new RoutingRuleRepositoryImpl(
            routingRuleSnapshotStore
        );
        
        this.paymentIntentRepository = new InMemoryPaymentIntentRepository(
            this.paymentMethodRepository
        );
        this.idempotencyStore = new InMemoryIdempotencyStore();
        this.eventPublisher = new InMemoryEventPublisher();
        this.paymentGateway = new FakePaymentGatewayAdapter();
        const gatewayRouting = new FakeGatewayRoutingAdapter();

        // Domain Services
        const paymentMethodGatewayMappingService = new PaymentMethodGatewayMappingServiceImpl(
            mappingRuleRepository
        );

        // Application Services
        const paymentMethodService = new PaymentMethodService(
            this.paymentMethodRepository,
            paymentMethodTypeRepository,
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
            paymentMethodGatewayMappingService,
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
            paymentMethodGatewayMappingService,
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

    /**
     * Initialize snapshot refresh engines.
     * 
     * This method:
     * - Loads snapshots on startup (blocks until complete)
     * - Starts periodic refresh for all snapshot stores
     * 
     * Must be called before the application starts serving requests.
     * 
     * @throws Error if initialization fails
     */
    async initialize(): Promise<void> {
        // Initialize PaymentMethodType snapshot
        await this.paymentMethodTypeRefreshEngine.initialize();
        this.paymentMethodTypeRefreshEngine.start();
        
        // Initialize PaymentGateway snapshot
        await this.paymentGatewayRefreshEngine.initialize();
        this.paymentGatewayRefreshEngine.start();
        
        // Initialize MappingRule snapshot
        await this.mappingRuleRefreshEngine.initialize();
        this.mappingRuleRefreshEngine.start();
        
        // Initialize RoutingRule snapshot
        await this.routingRuleRefreshEngine.initialize();
        this.routingRuleRefreshEngine.start();
    }

    reset(): void {
        this.paymentIntentRepository.clear();
        this.idempotencyStore.clear();
        this.eventPublisher.clear();
        this.paymentGateway.clear();
        
        // Stop periodic refresh on reset
        this.paymentMethodTypeRefreshEngine.stop();
        this.paymentGatewayRefreshEngine.stop();
        this.mappingRuleRefreshEngine.stop();
        this.routingRuleRefreshEngine.stop();
    }
}

