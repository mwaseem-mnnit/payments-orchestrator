import {GatewayWebhookPort} from "../port/GatewayWebhookPort";
import {GatewayWebhookAdapterRegistry} from "../port/GatewayWebhookAdapterRegistry";

// Direct Date usage is forbidden. Use Clock.
export class DefaultGatewayWebhookAdapterRegistry
    implements GatewayWebhookAdapterRegistry
{
    private readonly adapterMap: ReadonlyMap<string, GatewayWebhookPort>;

    constructor(adapters: ReadonlyArray<GatewayWebhookPort>) {
        const map = new Map<string, GatewayWebhookPort>();

        for (const adapter of adapters) {
            map.set(adapter.getGatewayId(), adapter);
        }

        this.adapterMap = map;
    }

    getAdapter(gatewayId: string): GatewayWebhookPort | undefined {
        return this.adapterMap.get(gatewayId);
    }
}
