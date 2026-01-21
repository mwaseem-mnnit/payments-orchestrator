import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {SystemClock} from "../adapters/system/SystemClock";
import {UlidIdGenerator} from "../adapters/system/UlidIdGenerator";
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
import {InMemoryEventPublisher} from "../adapters/inmemory/InMemoryEventPublisher";
import {StdoutJsonLogger} from "../adapters/logging/StdoutJsonLogger";
import {DynamoDbPaymentFactsRepository} from "../adapters/db/dynamodb/DynamoDbPaymentFactsRepository";
import {DynamoDbPaymentIntentRepository} from "../adapters/db/dynamodb/DynamoDbPaymentIntentRepository";
import {DynamoDbGatewayRefRepository} from "../adapters/db/dynamodb/DynamoDbGatewayRefRepository";
import {RazorpayWebhookAdapter} from "../adapters/gateway/razorpay/RazorpayWebhookAdapter";
import {RazorpayGatewayAdapter} from "../adapters/gateway/razorpay/RazorpayGatewayAdapter";
import {RazorpayHttpClient} from "../adapters/gateway/razorpay/RazorpayHttpClient";
import {AxiosHttpClient} from "../adapters/http/AxiosHttpClient";
import {PayinService} from "../application/services/PayinService";
import {PayoutService} from "../application/services/PayoutService";
import {FetchTransactionStatusService} from "../application/services/FetchTransactionStatusService";
import {ListTransactionsByUserService} from "../application/services/ListTransactionsByUserService";
import {FetchPaymentCapabilitiesService} from "../application/services/FetchPaymentCapabilitiesService";
import {PaymentMethodService} from "../application/services/PaymentMethodService";
import {PaymentIntentService} from "../application/services/PaymentIntentService";
import {DefaultPaymentStateMachine} from "../application/services/DefaultPaymentStateMachine";
import {ProcessPaymentFactUpdateService} from "../application/services/ProcessPaymentFactUpdateService";
import {WebhookService} from "../application/services/WebhookService";
import {DefaultGatewayWebhookAdapterRegistry} from "../application/registry/DefaultGatewayWebhookAdapterRegistry";
import {
    PaymentMethodGatewayMappingServiceImpl
} from "../domain/payment_method_gateway_mapping/PaymentMethodGatewayMappingServiceImpl";
import {PaymentMethodType} from "../domain/payment_method_type/PaymentMethodType";
import {PaymentGateway} from "../domain/gateway/PaymentGateway";
import {MappingRule} from "../domain/payment_method_gateway_mapping/MappingRule";
import {RoutingRule} from "../domain/routing/RoutingRule";
import {Logger} from "../application/port/Logger";
import {PaymentIntentRepository} from "../application/port/PaymentIntentRepository";
import {IdempotencyStore} from "../application/port/IdempotencyStore";
import {EventPublisher} from "../application/port/EventPublisher";
import {DynamoDbIdempotencyStore} from "../adapters/db/dynamodb/DynamoDbIdempotencyStore";
import {GatewayRoutingAdapter} from "../adapters/routing/GatewayRoutingAdapter";
import {PaymentMethodTypeRepository} from "../domain/payment_method_type/PaymentMethodTypeRepository";
import {PaymentGatewayRepository} from "../domain/gateway/PaymentGatewayRepository";
import {MappingRuleRepository} from "../domain/payment_method_gateway_mapping/MappingRuleRepository";
import {RoutingRuleRepository} from "../domain/routing/RoutingRuleRepository";
import {GatewayRefRepository} from "../application/port/GatewayRefRepository";
import {PaymentMethodRepository} from "../application/port/PaymentMethodRepository";
import {PaymentFactsRepository} from "../application/port/PaymentFactsRepository";
import {
    PaymentMethodGatewayMappingService
} from "../domain/payment_method_gateway_mapping/PaymentMethodGatewayMappingService";

export class ApplicationContainer {
    readonly payinService: PayinService;
    readonly makePayoutService: PayoutService;
    readonly fetchTransactionStatusService: FetchTransactionStatusService;
    readonly listTransactionsByUserService: ListTransactionsByUserService;
    readonly fetchPaymentCapabilitiesService: FetchPaymentCapabilitiesService;
    readonly webhookService: WebhookService;
    readonly clock: SystemClock;
    readonly idGenerator: UlidIdGenerator;
    readonly logger: Logger;

    private readonly paymentMethodTypeRepository: PaymentMethodTypeRepository;
    private readonly paymentGatewayRepository: PaymentGatewayRepository;
    private readonly mappingRuleRepository: MappingRuleRepository;
    private readonly routingRuleRepository: RoutingRuleRepository;
    private readonly paymentIntentRepository: PaymentIntentRepository;
    private readonly paymentMethodRepository: PaymentMethodRepository;
    private readonly idempotencyStore: IdempotencyStore;
    private readonly eventPublisher: EventPublisher;
    private readonly paymentFactsRepository: PaymentFactsRepository;
    private readonly gatewayRefRepository: GatewayRefRepository;
    
    // Snapshot refresh engines (for lifecycle management)
    private readonly paymentMethodTypeRefreshEngine: GenericRefreshEngine<PaymentMethodType>;
    private readonly paymentGatewayRefreshEngine: GenericRefreshEngine<PaymentGateway>;
    private readonly mappingRuleRefreshEngine: GenericRefreshEngine<MappingRule>;
    private readonly routingRuleRefreshEngine: GenericRefreshEngine<RoutingRule>;

    private readonly paymentMethodGatewayMappingService: PaymentMethodGatewayMappingService;
    private readonly paymentMethodService: PaymentMethodService;
    private readonly paymentIntentService: PaymentIntentService;
    private readonly processPaymentFactUpdateService: ProcessPaymentFactUpdateService;

    constructor() {
        // System Adapters
        this.clock = new SystemClock();
        this.idGenerator = new UlidIdGenerator();
        this.logger = new StdoutJsonLogger(
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
            this.logger
        );
        this.paymentMethodTypeRepository = new PaymentMethodTypeRepositoryImpl(
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
            this.logger
        );
         this.paymentGatewayRepository = new PaymentGatewayRepositoryImpl(
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
            this.logger
        );
         this.mappingRuleRepository = new MappingRuleRepositoryImpl(
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
            this.logger
        );

        this.routingRuleRepository = new RoutingRuleRepositoryImpl(
            routingRuleSnapshotStore
        );

        this.eventPublisher = new InMemoryEventPublisher();

        const dynamoDbClient = new DynamoDBClient({
            region: process.env.AWS_REGION || "us-east-1",
            endpoint: process.env.DYNAMODB_ENDPOINT || undefined
        });

        this.idempotencyStore = new DynamoDbIdempotencyStore(
            dynamoDbClient,
            process.env.IDEMPOTENCY_STORE_TABLE_NAME || "",
            this.clock,
            this.logger
        );

        this.paymentIntentRepository = new DynamoDbPaymentIntentRepository(
            dynamoDbClient,
            process.env.PAYMENT_INTENTS_TABLE_NAME || "",
            process.env.PAYMENT_INTENTS_GSI_NAME || "",
            this.clock,
            this.logger
        );

        this.paymentFactsRepository = new DynamoDbPaymentFactsRepository(
            dynamoDbClient,
            process.env.PAYMENT_FACTS_TABLE_NAME || "",
            process.env.PAYMENT_FACTS_GSI1_NAME || "",
            process.env.PAYMENT_FACTS_GSI2_NAME || "",
            this.clock,
            this.logger
        );

        const httpClient = new AxiosHttpClient(this.logger);
        const razorpayHttpClient = new RazorpayHttpClient(
            httpClient,
            this.logger,
            {
                baseUrl: process.env.RAZORPAY_BASE_URL || "",
                keyId: process.env.RAZORPAY_KEY_ID || "",
                keySecret: process.env.RAZORPAY_KEY_SECRET || "",
                timeoutMs: 10000
            }
        );

        this.gatewayRefRepository = new DynamoDbGatewayRefRepository(
            dynamoDbClient,
            process.env.GATEWAY_REF_TABLE_NAME || "",
            process.env.GATEWAY_REF_GSI_NAME || "",
            this.clock,
            this.logger
        );

        const gatewayRouting = new GatewayRoutingAdapter(
            this.routingRuleRepository,
            this.clock
        );


        const razorpayGatewayAdapter = new RazorpayGatewayAdapter(
            "RAZORPAY",
            razorpayHttpClient,
            this.gatewayRefRepository,
            this.idGenerator,
            this.clock
        );

        // Domain Services
        this.paymentMethodGatewayMappingService = new PaymentMethodGatewayMappingServiceImpl(
            this.mappingRuleRepository
        );

        // Application Services
        this.paymentMethodService = new PaymentMethodService(
            this.paymentMethodRepository,
            this.paymentMethodTypeRepository,
            this.idGenerator,
            this.logger
        );

        this.paymentIntentService = new PaymentIntentService(
            this.paymentIntentRepository,
            this.idempotencyStore,
            this.idGenerator,
            this.clock,
            this.logger
        );

        const razorpayWebhookAdapter = new RazorpayWebhookAdapter(
            process.env.RAZORPAY_WEBHOOK_SECRET || "",
            "RAZORPAY",
            this.idGenerator,
            this.clock,
            this.logger
        );

        const webhookAdapterRegistry = new DefaultGatewayWebhookAdapterRegistry(
            [razorpayWebhookAdapter],
            [razorpayGatewayAdapter]
        );

        this.payinService = new PayinService(
            this.paymentMethodService,
            this.paymentIntentService,
            this.paymentMethodGatewayMappingService,
            gatewayRouting,
            webhookAdapterRegistry,
            this.eventPublisher,
            this.clock,
            this.idGenerator,
            this.logger
        );

        this.makePayoutService = new PayoutService(
            this.paymentMethodService,
            this.paymentIntentService,
            this.paymentMethodGatewayMappingService,
            gatewayRouting,
            webhookAdapterRegistry,
            this.eventPublisher,
            this.clock,
            this.idGenerator,
            this.logger
        );


        this.fetchTransactionStatusService = new FetchTransactionStatusService(
            this.paymentIntentRepository,
            this.paymentMethodRepository
        );

        this.listTransactionsByUserService = new ListTransactionsByUserService(
            this.paymentIntentRepository,
            this.paymentMethodRepository
        );

        this.fetchPaymentCapabilitiesService = new FetchPaymentCapabilitiesService(
            this.paymentMethodTypeRepository,
            this.paymentMethodRepository,
            this.clock,
            this.logger
        );

        const paymentStateMachine = new DefaultPaymentStateMachine();
        this.processPaymentFactUpdateService = new ProcessPaymentFactUpdateService(
            this.paymentFactsRepository,
            this.paymentIntentRepository,
            paymentStateMachine,
            this.eventPublisher,
            this.clock,
            this.logger
        );

        this.webhookService = new WebhookService(
            webhookAdapterRegistry,
            this.paymentFactsRepository,
            this.processPaymentFactUpdateService,
            this.logger
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

        // Stop periodic refresh on reset
        this.paymentMethodTypeRefreshEngine.stop();
        this.paymentGatewayRefreshEngine.stop();
        this.mappingRuleRefreshEngine.stop();
        this.routingRuleRefreshEngine.stop();
    }
}

