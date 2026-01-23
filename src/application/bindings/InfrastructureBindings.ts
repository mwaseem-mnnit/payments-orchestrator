import {Clock} from "../port/Clock";
import {EventPublisher} from "../port/EventPublisher";
import {GatewayAdapterRegistry} from "../port/GatewayAdapterRegistry";
import {GatewayRoutingPort} from "../port/GatewayRoutingPort";
import {HttpClient} from "../port/HttpClient";
import {IdGenerator} from "../port/IdGenerator";
import {IdempotencyStore} from "../port/IdempotencyStore";
import {Logger} from "../port/Logger";
import {PaymentFactsRepository} from "../port/PaymentFactsRepository";
import {PaymentIntentRepository} from "../port/PaymentIntentRepository";
import {PaymentMethodRepository} from "../port/PaymentMethodRepository";
import {RefreshEngine} from "../shared/snapshot/RefreshEngine";
import {MappingRuleRepository} from "../../domain/payment_method_gateway_mapping/MappingRuleRepository";
import {PaymentMethodTypeRepository} from "../../domain/payment_method_type/PaymentMethodTypeRepository";
import {PaymentGatewayRepository} from "../../domain/gateway/PaymentGatewayRepository";
import {RoutingRuleRepository} from "../../domain/routing/RoutingRuleRepository";

export interface InfrastructureBindings {
    readonly paymentIntentRepository: PaymentIntentRepository;
    readonly paymentFactsRepository: PaymentFactsRepository;
    readonly paymentMethodRepository: PaymentMethodRepository;
    readonly paymentMethodTypeRepository: PaymentMethodTypeRepository;
    readonly paymentGatewayRepository: PaymentGatewayRepository;
    readonly mappingRuleRepository: MappingRuleRepository;
    readonly routingRuleRepository: RoutingRuleRepository;
    readonly gatewayAdapterRegistry: GatewayAdapterRegistry;
    readonly gatewayRoutingAdapter: GatewayRoutingPort;
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
    readonly logger: Logger;
    readonly eventPublisher: EventPublisher;
    readonly idempotencyStore: IdempotencyStore;
    readonly refreshEngines: ReadonlyArray<RefreshEngine>;
    readonly httpClient?: HttpClient;
}
