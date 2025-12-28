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
                paymentMethod: "UPI",
            }),
        });

        expect(response.status).toBe(200);

        const result = await response.json();

        expect(result).toMatchObject({
            transactionId: "txn_test_001",
            amount: 1000.50,
            paymentMethod: "UPI",
            currency: "INR",
            status: "GATEWAY_INITIATED",
        });

        expect(result.paymentIntentId).toBeDefined();
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
                paymentMethod: "CARD",
                currency: "USD",
                userIdentifier: "user_12345",
                customerData: {
                    name: "John Doe",
                    email: "john@example.com",
                },
                cardData: {
                    cardNumber: "4111111111111111",
                    cvv: "123",
                    expiryMonth: "12",
                    expiryYear: "2025",
                },
                paymentGateway: "RAZORPAY",
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
            paymentMethod: "CARD",
            currency: "USD",
            status: "GATEWAY_INITIATED",
            gateway: "RAZORPAY",
        });

        expect(result.paymentIntentId).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
    });

    test("enforces idempotency for duplicate transactionId", async () => {
        const requestBody = {
            transactionId: "txn_idempotent_001",
            amount: 1500.00,
            paymentMethod: "UPI",
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
                paymentMethod: "UPI",
            }),
        });

        expect(response.status).toBe(500);
    });

    test("returns validation error for missing amount", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_test_003",
                paymentMethod: "UPI",
            }),
        });

        expect(response.status).toBe(500);
    });

    test("returns validation error for missing paymentMethod", async () => {
        const response = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_test_004",
                amount: 1000.50,
            }),
        });

        expect(response.status).toBe(500);
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
                paymentMethod: "UPI",
            }),
        });

        expect(response.status).toBe(500);
    });
});

