import {
    GatewayRoutingPort,
    GatewayRoutingRequest,
    GatewayRoutingResult
} from "../../application/port/GatewayRoutingPort";
import { GatewayHealthStatus } from "../../domain/routing/GatewayHealthStatus";

/**
 * Fake implementation of GatewayRoutingPort for testing.
 * 
 * Always returns the default gateway without evaluating any routing rules.
 * Useful for unit tests and development environments.
 */
export class FakeGatewayRoutingAdapter implements GatewayRoutingPort {
    private readonly defaultGateway = "FAKE_GATEWAY";

    async selectGateway(
        _request: GatewayRoutingRequest,
        _eligibleGateways: string[],
        _gatewayHealth: Map<string, GatewayHealthStatus>
    ): Promise<GatewayRoutingResult> {
        return GatewayRoutingResult.success(
            this.defaultGateway,
            "FAKE_RULE",
            1,
            false,
            new Date()
        );
    }
}

