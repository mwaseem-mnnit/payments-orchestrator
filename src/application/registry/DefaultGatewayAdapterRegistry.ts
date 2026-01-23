import {GatewayWebhookPort} from "../port/GatewayWebhookPort";
import {GatewayAdapterRegistry} from "../port/GatewayAdapterRegistry";
import {PaymentGatewayPort} from "../port/PaymentGatewayPort";

// Direct Date usage is forbidden. Use Clock.
export class DefaultGatewayAdapterRegistry
    implements GatewayAdapterRegistry
{
    private readonly webhookAdapterMap: ReadonlyMap<string, GatewayWebhookPort>;
    private readonly gatewayAdapterMap: ReadonlyMap<string, PaymentGatewayPort>;

    constructor(
        webhookAdapters: ReadonlyArray<GatewayWebhookPort>,
        gatewayAdapters: ReadonlyArray<PaymentGatewayPort>
    ) {
        /** register all Payment Webhook adapters **/
        const webhookMap = new Map<string, GatewayWebhookPort>();
        for (const adapter of webhookAdapters) {
            webhookMap.set(adapter.getGatewayId(), adapter);
        }

        this.webhookAdapterMap = webhookMap;

        /** register all Payment Gateway adapters **/
        const gatewayMap = new Map<string, PaymentGatewayPort>();
        for (const adapter of gatewayAdapters) {
            gatewayMap.set(adapter.getGatewayId(), adapter);
        }

        this.gatewayAdapterMap = gatewayMap;
    }

    getWebhookAdapter(gatewayId: string): GatewayWebhookPort | undefined {
        return this.webhookAdapterMap.get(gatewayId);
    }

    getGatewayAdapter(gatewayId: string): PaymentGatewayPort | undefined {
        return this.gatewayAdapterMap.get(gatewayId);
    }

}
