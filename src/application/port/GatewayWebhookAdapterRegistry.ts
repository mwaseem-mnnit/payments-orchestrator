import {GatewayWebhookPort} from "./GatewayWebhookPort";

export interface GatewayWebhookAdapterRegistry {
    getAdapter(gatewayId: string): GatewayWebhookPort | undefined;
}
