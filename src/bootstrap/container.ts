import {InfrastructureBindings} from "../application/bindings/InfrastructureBindings";
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
import {PaymentMethodGatewayMappingServiceImpl} from "../domain/payment_method_gateway_mapping/PaymentMethodGatewayMappingServiceImpl";
import {Logger} from "../application/port/Logger";
import {PaymentIntentRepository} from "../application/port/PaymentIntentRepository";
import {IdempotencyStore} from "../application/port/IdempotencyStore";
import {EventPublisher} from "../application/port/EventPublisher";
import {GatewayRoutingPort} from "../application/port/GatewayRoutingPort";
import {PaymentMethodTypeRepository} from "../domain/payment_method_type/PaymentMethodTypeRepository";
import {MappingRuleRepository} from "../domain/payment_method_gateway_mapping/MappingRuleRepository";
import {PaymentMethodRepository} from "../application/port/PaymentMethodRepository";
import {PaymentFactsRepository} from "../application/port/PaymentFactsRepository";
import {PaymentMethodGatewayMappingService} from "../domain/payment_method_gateway_mapping/PaymentMethodGatewayMappingService";
import {GatewayAdapterRegistry} from "../application/port/GatewayAdapterRegistry";
import {Clock} from "../application/port/Clock";
import {IdGenerator} from "../application/port/IdGenerator";
import {RefreshEngine} from "../application/shared/snapshot/RefreshEngine";

export class ApplicationContainer {
    readonly payinService: PayinService;
    readonly makePayoutService: PayoutService;
    readonly fetchTransactionStatusService: FetchTransactionStatusService;
    readonly listTransactionsByUserService: ListTransactionsByUserService;
    readonly fetchPaymentCapabilitiesService: FetchPaymentCapabilitiesService;
    readonly webhookService: WebhookService;
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
    readonly logger: Logger;

    private readonly paymentMethodTypeRepository: PaymentMethodTypeRepository;
    private readonly mappingRuleRepository: MappingRuleRepository;
    private readonly paymentIntentRepository: PaymentIntentRepository;
    private readonly paymentMethodRepository: PaymentMethodRepository;
    private readonly idempotencyStore: IdempotencyStore;
    private readonly eventPublisher: EventPublisher;
    private readonly paymentFactsRepository: PaymentFactsRepository;
    private readonly gatewayAdapterRegistry: GatewayAdapterRegistry;
    private readonly gatewayRoutingAdapter: GatewayRoutingPort;
    private readonly refreshEngines: ReadonlyArray<RefreshEngine>;

    private readonly paymentMethodGatewayMappingService: PaymentMethodGatewayMappingService;
    private readonly paymentMethodService: PaymentMethodService;
    private readonly paymentIntentService: PaymentIntentService;
    private readonly processPaymentFactUpdateService: ProcessPaymentFactUpdateService;

    constructor(bindings: InfrastructureBindings) {
        this.clock = bindings.clock;
        this.idGenerator = bindings.idGenerator;
        this.logger = bindings.logger;
        this.eventPublisher = bindings.eventPublisher;
        this.idempotencyStore = bindings.idempotencyStore;
        this.paymentIntentRepository = bindings.paymentIntentRepository;
        this.paymentFactsRepository = bindings.paymentFactsRepository;
        this.paymentMethodRepository = bindings.paymentMethodRepository;
        this.paymentMethodTypeRepository = bindings.paymentMethodTypeRepository;
        this.mappingRuleRepository = bindings.mappingRuleRepository;
        this.gatewayAdapterRegistry = bindings.gatewayAdapterRegistry;
        this.gatewayRoutingAdapter = bindings.gatewayRoutingAdapter;
        this.refreshEngines = bindings.refreshEngines;

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

        this.payinService = new PayinService(
            this.paymentMethodService,
            this.paymentIntentService,
            this.paymentMethodGatewayMappingService,
            this.gatewayRoutingAdapter,
            this.gatewayAdapterRegistry,
            this.eventPublisher,
            this.clock,
            this.idGenerator,
            this.logger
        );

        this.makePayoutService = new PayoutService(
            this.paymentMethodService,
            this.paymentIntentService,
            this.paymentMethodGatewayMappingService,
            this.gatewayRoutingAdapter,
            this.gatewayAdapterRegistry,
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
            this.gatewayAdapterRegistry,
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
        for (const refreshEngine of this.refreshEngines) {
            await refreshEngine.initialize();
            refreshEngine.start();
        }
    }

    reset(): void {
        // Stop periodic refresh on reset
        for (const refreshEngine of this.refreshEngines) {
            refreshEngine.stop();
        }
    }
}
