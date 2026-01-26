import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {InfrastructureBindings} from "./InfrastructureBindings";
import {SystemClock} from "../../adapters/system/SystemClock";
import {UlidIdGenerator} from "../../adapters/system/UlidIdGenerator";
import {StdoutJsonLogger} from "../../adapters/logging/StdoutJsonLogger";
import {InMemoryEventPublisher} from "../../adapters/inmemory/InMemoryEventPublisher";
import {AxiosHttpClient} from "../../adapters/http/AxiosHttpClient";
import {DynamoDbIdempotencyStore} from "../../adapters/db/dynamodb/DynamoDbIdempotencyStore";
import {DynamoDbPaymentIntentRepository} from "../../adapters/db/dynamodb/DynamoDbPaymentIntentRepository";
import {DynamoDbPaymentFactsRepository} from "../../adapters/db/dynamodb/DynamoDbPaymentFactsRepository";
import {DynamoDbPaymentMethodRepository} from "../../adapters/db/dynamodb/DynamoDbPaymentMethodRepository";
import {DynamoDbGatewayRefRepository} from "../../adapters/db/dynamodb/DynamoDbGatewayRefRepository";
import {RazorpayHttpClient} from "../../adapters/gateway/razorpay/RazorpayHttpClient";
import {RazorpayGatewayAdapter} from "../../adapters/gateway/razorpay/RazorpayGatewayAdapter";
import {RazorpayWebhookAdapter} from "../../adapters/gateway/razorpay/RazorpayWebhookAdapter";
import {DefaultGatewayAdapterRegistry} from "../registry/DefaultGatewayAdapterRegistry";
import {GatewayRoutingAdapter} from "../../adapters/routing/GatewayRoutingAdapter";
import {InMemorySnapshotStore} from "../../adapters/inmemory/InMemorySnapshotStore";
import {GenericRefreshEngine} from "../../adapters/inmemory/GenericRefreshEngine";
import {JsonPaymentMethodTypeSnapshotLoader} from "../../adapters/snapshot/JsonPaymentMethodTypeSnapshotLoader";
import {JsonPaymentGatewaySnapshotLoader} from "../../adapters/snapshot/JsonPaymentGatewaySnapshotLoader";
import {JsonMappingRuleSnapshotLoader} from "../../adapters/snapshot/JsonMappingRuleSnapshotLoader";
import {JsonRoutingRuleSnapshotLoader} from "../../adapters/snapshot/JsonRoutingRuleSnapshotLoader";
import {PaymentMethodTypeRepositoryImpl} from "../../adapters/inmemory/PaymentMethodTypeRepositoryImpl";
import {PaymentGatewayRepositoryImpl} from "../../adapters/inmemory/PaymentGatewayRepositoryImpl";
import {MappingRuleRepositoryImpl} from "../../adapters/inmemory/MappingRuleRepositoryImpl";
import {RoutingRuleRepositoryImpl} from "../../adapters/inmemory/RoutingRuleRepositoryImpl";
import {PaymentMethodType} from "../../domain/payment_method_type/PaymentMethodType";
import {PaymentGateway} from "../../domain/gateway/PaymentGateway";
import {MappingRule} from "../../domain/payment_method_gateway_mapping/MappingRule";
import {RoutingRule} from "../../domain/routing/RoutingRule";

export class ProductionBindings {
    static create(): InfrastructureBindings {
        const clock = new SystemClock();
        const idGenerator = new UlidIdGenerator();
        const logger = new StdoutJsonLogger(
            clock,
            process.env.SERVICE_NAME ||"payments-orchestrator",
            process.env.NODE_ENV || "development"
        );

        const eventPublisher = new InMemoryEventPublisher();
        const httpClient = new AxiosHttpClient(logger);

        const dynamoDbClient = new DynamoDBClient({
            region: process.env.AWS_REGION || "ap-south-1",
            endpoint: process.env.DYNAMODB_ENDPOINT || undefined
        });

        const idempotencyStore = new DynamoDbIdempotencyStore(
            dynamoDbClient,
            process.env.IDEMPOTENCY_STORE_TABLE_NAME || "",
            clock,
            logger
        );

        const paymentIntentRepository = new DynamoDbPaymentIntentRepository(
            dynamoDbClient,
            process.env.PAYMENT_INTENTS_TABLE_NAME || "",
            clock,
            logger
        );

        const paymentFactsRepository = new DynamoDbPaymentFactsRepository(
            dynamoDbClient,
            process.env.PAYMENT_FACTS_TABLE_NAME || "",
            clock,
            logger
        );

        const paymentMethodRepository = new DynamoDbPaymentMethodRepository(
            dynamoDbClient,
            process.env.PAYMENT_METHODS_TABLE_NAME || "",
            process.env.PAYMENT_METHOD_IDENTIFIERS_TABLE_NAME || "",
            clock,
            logger
        );

        const gatewayRefRepository = new DynamoDbGatewayRefRepository(
            dynamoDbClient,
            process.env.GATEWAY_REF_TABLE_NAME || "",
            clock,
            logger
        );

        const paymentMethodTypeSnapshotStore = new InMemorySnapshotStore<PaymentMethodType>();
        const paymentMethodTypeSnapshotLoader = new JsonPaymentMethodTypeSnapshotLoader(
            process.env.PAYMENT_METHOD_TYPE_SNAPSHOT_FILE || "./data/payment-method-types.json"
        );
        const paymentMethodTypeRefreshIntervalMs = parseInt(
            process.env.PAYMENT_METHOD_TYPE_REFRESH_INTERVAL_MS || "300000",
            10
        );
        const paymentMethodTypeRefreshEngine = new GenericRefreshEngine(
            paymentMethodTypeSnapshotLoader,
            paymentMethodTypeSnapshotStore,
            paymentMethodTypeRefreshIntervalMs,
            logger
        );
        const paymentMethodTypeRepository = new PaymentMethodTypeRepositoryImpl(
            paymentMethodTypeSnapshotStore
        );

        const paymentGatewaySnapshotStore = new InMemorySnapshotStore<PaymentGateway>();
        const paymentGatewaySnapshotLoader = new JsonPaymentGatewaySnapshotLoader(
            process.env.PAYMENT_GATEWAY_SNAPSHOT_FILE || "./data/payment-gateways.json"
        );
        const paymentGatewayRefreshIntervalMs = parseInt(
            process.env.PAYMENT_GATEWAY_REFRESH_INTERVAL_MS || "300000",
            10
        );
        const paymentGatewayRefreshEngine = new GenericRefreshEngine(
            paymentGatewaySnapshotLoader,
            paymentGatewaySnapshotStore,
            paymentGatewayRefreshIntervalMs,
            logger
        );
        const paymentGatewayRepository = new PaymentGatewayRepositoryImpl(paymentGatewaySnapshotStore);

        const mappingRuleSnapshotStore = new InMemorySnapshotStore<MappingRule>();
        const mappingRuleSnapshotLoader = new JsonMappingRuleSnapshotLoader(
            process.env.MAPPING_RULE_SNAPSHOT_FILE || "./data/mapping-rules.json"
        );
        const mappingRuleRefreshIntervalMs = parseInt(
            process.env.MAPPING_RULE_REFRESH_INTERVAL_MS || "300000",
            10
        );
        const mappingRuleRefreshEngine = new GenericRefreshEngine(
            mappingRuleSnapshotLoader,
            mappingRuleSnapshotStore,
            mappingRuleRefreshIntervalMs,
            logger
        );
        const mappingRuleRepository = new MappingRuleRepositoryImpl(
            mappingRuleSnapshotStore
        );

        const routingRuleSnapshotStore = new InMemorySnapshotStore<RoutingRule>();
        const routingRuleSnapshotLoader = new JsonRoutingRuleSnapshotLoader(
            process.env.ROUTING_RULE_SNAPSHOT_FILE || "./data/routing-rules.json"
        );
        const routingRuleRefreshIntervalMs = parseInt(
            process.env.ROUTING_RULE_REFRESH_INTERVAL_MS || "300000",
            10
        );
        const routingRuleRefreshEngine = new GenericRefreshEngine(
            routingRuleSnapshotLoader,
            routingRuleSnapshotStore,
            routingRuleRefreshIntervalMs,
            logger
        );
        const routingRuleRepository = new RoutingRuleRepositoryImpl(
            routingRuleSnapshotStore
        );

        const razorpayHttpClient = new RazorpayHttpClient(
            httpClient,
            logger,
            {
                baseUrl: process.env.RAZORPAY_BASE_URL || "",
                keyId: process.env.RAZORPAY_KEY_ID || "",
                keySecret: process.env.RAZORPAY_KEY_SECRET || "",
                timeoutMs: 10000
            }
        );

        const razorpayGatewayAdapter = new RazorpayGatewayAdapter(
            "RAZORPAY",
            razorpayHttpClient,
            gatewayRefRepository,
            idGenerator,
            clock
        );

        const razorpayWebhookAdapter = new RazorpayWebhookAdapter(
            process.env.RAZORPAY_WEBHOOK_SECRET || "",
            "RAZORPAY",
            idGenerator,
            clock,
            logger
        );

        const gatewayAdapterRegistry = new DefaultGatewayAdapterRegistry(
            [razorpayWebhookAdapter],
            [razorpayGatewayAdapter]
        );

        const gatewayRoutingAdapter = new GatewayRoutingAdapter(
            routingRuleRepository,
            clock
        );

        const refreshEngines = [
            paymentMethodTypeRefreshEngine,
            paymentGatewayRefreshEngine,
            mappingRuleRefreshEngine,
            routingRuleRefreshEngine
        ];

        return {
            paymentIntentRepository,
            paymentFactsRepository,
            paymentMethodRepository,
            paymentMethodTypeRepository,
            paymentGatewayRepository,
            mappingRuleRepository,
            routingRuleRepository,
            gatewayAdapterRegistry,
            gatewayRoutingAdapter,
            clock,
            idGenerator,
            logger,
            eventPublisher,
            idempotencyStore,
            refreshEngines,
            httpClient
        };
    }
}
