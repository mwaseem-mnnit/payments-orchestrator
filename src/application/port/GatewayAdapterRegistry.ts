import {GatewayWebhookPort} from "./GatewayWebhookPort";
import {PaymentGatewayPort} from "./PaymentGatewayPort";

export interface GatewayAdapterRegistry {

    getWebhookAdapter(gatewayId: string): GatewayWebhookPort | undefined;

    getGatewayAdapter(gatewayId: string): PaymentGatewayPort | undefined;

}
