import { TestServer } from "./TestServer";

describe("Journey 05: Create Payment Intent (Payin)", () => {
    let testServer: TestServer;
    let baseUrl: string;

    beforeAll(async () => {
        testServer = new TestServer();
        await testServer.start();
        baseUrl = testServer.getBaseUrl();
    });

    afterAll(async () => {
        await testServer.stop();
    });

    beforeEach(() => {
        testServer.resetState();
    });

    test("creates payment intent with minimal required fields", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_test_001",
                amount: 1000.50,
                userIdentifier: "user_test_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "user@upi"
                        }
                    ]
                },
                currency: "INR"
            }),
        });

        expect(response.status).toBe(200);

        const result = await response.json();

        expect(result).toMatchObject({
            transactionId: "txn_test_001",
            amount: 1000.50,
            currency: "INR",
            status: "GATEWAY_INITIATED",
        });

        expect(result.paymentIntentId).toBeDefined();
        expect(result.paymentMethod).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
        expect(result.gateway).toBeDefined();
    });

    test("creates payment intent with all optional fields", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_test_002",
                amount: 2500.75,
                userIdentifier: "user_12345",
                paymentMethodInput: {
                    methodTypeId: "CARD",
                    identifiers: [
                        {
                            identifierType: "CARD_INSTRUMENT",
                            identifierValue: "card_instrument_123"
                        }
                    ],
                    variant: "VISA"
                },
                currency: "INR",
                preferredGateway: "RAZORPAY",
                gatewayContext: {
                    name: "John Doe",
                    email: "john@example.com",
                },
                additionalAttributes: {
                    orderId: "order_123",
                    metadata: "test_metadata",
                },
            }),
        });

        expect(response.status).toBe(200);

        const result = await response.json();

        expect(result).toMatchObject({
            transactionId: "txn_test_002",
            amount: 2500.75,
            currency: "INR",
            status: "GATEWAY_INITIATED",
            gateway: "RAZORPAY",
        });

        expect(result.paymentIntentId).toBeDefined();
        expect(result.paymentMethod).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
    });

    test("enforces idempotency for duplicate transactionId", async () => {
        const requestBody = {
            transactionId: "txn_idempotent_001",
            amount: 1500.00,
            userIdentifier: "user_idempotent_001",
            paymentMethodInput: {
                methodTypeId: "UPI",
                identifiers: [
                    {
                        identifierType: "UPI_VPA",
                        identifierValue: "user@upi"
                    }
                ]
            },
            currency: "INR"
        };

        const firstResponse = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        expect(firstResponse.status).toBe(200);
        const firstResult = await firstResponse.json();

        const secondResponse = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        expect(secondResponse.status).toBe(200);
        const secondResult = await secondResponse.json();

        expect(firstResult.paymentIntentId).toBe(secondResult.paymentIntentId);
        expect(firstResult.transactionId).toBe(secondResult.transactionId);
    });

    test("returns validation error for missing transactionId", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: 1000.50,
                userIdentifier: "user_test_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "user@upi"
                        }
                    ]
                },
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("returns validation error for missing amount", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_test_003",
                userIdentifier: "user_test_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "user@upi"
                        }
                    ]
                },
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("returns validation error for missing paymentMethodInput and paymentMethodId", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_test_004",
                amount: 1000.50,
                userIdentifier: "user_test_001",
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("returns validation error for missing userIdentifier", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_test_004",
                amount: 1000.50,
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "user@upi"
                        }
                    ]
                },
            }),
        });

        expect(response.status).toBe(400);
    });

    test("returns validation error for negative amount", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_test_005",
                amount: -100.00,
                userIdentifier: "user_test_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "user@upi"
                        }
                    ]
                },
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });
});

