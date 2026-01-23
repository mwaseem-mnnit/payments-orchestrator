import {InfrastructureBindings} from "./InfrastructureBindings";
import {FixedClock} from "../../adapters/fake/FixedClock";
import {SequentialIdGenerator} from "../../adapters/fake/SequentialIdGenerator";
import {StdoutJsonLogger} from "../../adapters/logging/StdoutJsonLogger";
import {InMemoryEventPublisher} from "../../adapters/inmemory/InMemoryEventPublisher";
import {InMemoryPaymentMethodRepository} from "../../adapters/inmemory/InMemoryPaymentMethodRepository";
import {InMemoryPaymentIntentRepository} from "../../adapters/inmemory/InMemoryPaymentIntentRepository";
import {InMemoryPaymentFactsRepository} from "../../adapters/inmemory/InMemoryPaymentFactsRepository";
import {DeterministicIdempotencyStore} from "../../adapters/fake/DeterministicIdempotencyStore";
import {FakePaymentGatewayAdapter} from "../../adapters/fake/FakePaymentGatewayAdapter";
import {FakeGatewayWebhookAdapter} from "../../adapters/fake/FakeGatewayWebhookAdapter";
import {DefaultGatewayAdapterRegistry} from "../registry/DefaultGatewayAdapterRegistry";
import {FakeGatewayRoutingAdapter} from "../../adapters/fake/FakeGatewayRoutingAdapter";
import {InMemorySnapshotStore} from "../../adapters/inmemory/InMemorySnapshotStore";
import {PaymentMethodTypeRepositoryImpl} from "../../adapters/inmemory/PaymentMethodTypeRepositoryImpl";
import {MappingRuleRepositoryImpl} from "../../adapters/inmemory/MappingRuleRepositoryImpl";
import {PaymentMethodType} from "../../domain/payment_method_type/PaymentMethodType";
import {MappingRule} from "../../domain/payment_method_gateway_mapping/MappingRule";
import {PaymentGateway} from "../../domain/gateway/PaymentGateway";
import {PaymentGatewayRepositoryImpl} from "../../adapters/inmemory/PaymentGatewayRepositoryImpl";
import {RoutingRule} from "../../domain/routing/RoutingRule";
import {RoutingRuleRepositoryImpl} from "../../adapters/inmemory/RoutingRuleRepositoryImpl";

export class TestBindings {
    static create(): InfrastructureBindings {
        const clock = new FixedClock(0);
        const idGenerator = new SequentialIdGenerator();
        const logger = new StdoutJsonLogger(
            clock,
            "payments-orchestrator-test",
            "test"
        );

        const eventPublisher = new InMemoryEventPublisher();
        const idempotencyStore = new DeterministicIdempotencyStore(clock);

        const paymentMethodRepository = new InMemoryPaymentMethodRepository();
        const paymentIntentRepository = new InMemoryPaymentIntentRepository(
            paymentMethodRepository
        );
        const paymentFactsRepository = new InMemoryPaymentFactsRepository();

        const paymentMethodTypeSnapshotStore = new InMemorySnapshotStore<PaymentMethodType>();
        const paymentMethodTypeRepository = new PaymentMethodTypeRepositoryImpl(
            paymentMethodTypeSnapshotStore
        );

        const paymentGatewaySnapshotStore = new InMemorySnapshotStore<PaymentGateway>();
        const paymentGatewayRepository = new PaymentGatewayRepositoryImpl(
            paymentGatewaySnapshotStore
        );

        const mappingRuleSnapshotStore = new InMemorySnapshotStore<MappingRule>();
        const mappingRuleRepository = new MappingRuleRepositoryImpl(
            mappingRuleSnapshotStore
        );

        const routingRuleSnapshotStore = new InMemorySnapshotStore<RoutingRule>();
        const routingRuleRepository = new RoutingRuleRepositoryImpl(
            routingRuleSnapshotStore
        );

        const fakeGatewayAdapter = new FakePaymentGatewayAdapter();
        const fakeWebhookAdapter = new FakeGatewayWebhookAdapter(
            fakeGatewayAdapter.getGatewayId(),
            clock,
            idGenerator
        );

        const gatewayAdapterRegistry = new DefaultGatewayAdapterRegistry(
            [fakeWebhookAdapter],
            [fakeGatewayAdapter]
        );

        const gatewayRoutingAdapter = new FakeGatewayRoutingAdapter();

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
            refreshEngines: []
        };
    }
}
