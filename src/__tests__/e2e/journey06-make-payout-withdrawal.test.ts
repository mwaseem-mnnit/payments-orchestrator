import { TestServer } from "./TestServer";

describe("Journey 06: Make Payout / Withdrawal", () => {
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

    test("creates payout with minimal required fields", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_001",
                amount: 5000.00,
                userIdentifier: "user_payout_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "beneficiary@upi"
                        }
                    ]
                },
                currency: "INR"
            }),
        });

        expect(response.status).toBe(200);

        const result = await response.json();

        expect(result).toMatchObject({
            transactionId: "payout_test_001",
            amount: 5000.00,
            currency: "INR",
            status: "GATEWAY_INITIATED",
        });

        expect(result.paymentIntentId).toBeDefined();
        expect(result.paymentMethod).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
        expect(result.gateway).toBeDefined();
    });

    test("creates payout with all optional fields", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_002",
                amount: 10000.50,
                userIdentifier: "user_payout_002",
                paymentMethodInput: {
                    methodTypeId: "BANK_ACCOUNT",
                    identifiers: [
                        {
                            identifierType: "BANK_ACCOUNT",
                            identifierValue: "1234567890|SBIN0001234"
                        }
                    ]
                },
                currency: "INR",
                preferredGateway: "CASHFREE",
                gatewayContext: {
                    name: "Jane Doe",
                    email: "jane@example.com",
                    bankName: "State Bank of India",
                },
                additionalAttributes: {
                    purpose: "salary",
                    reference: "ref_123",
                },
            }),
        });

        expect(response.status).toBe(200);

        const result = await response.json();

        expect(result).toMatchObject({
            transactionId: "payout_test_002",
            amount: 10000.50,
            currency: "INR",
            status: "GATEWAY_INITIATED",
            gateway: "CASHFREE",
        });

        expect(result.paymentIntentId).toBeDefined();
        expect(result.paymentMethod).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
    });

    test("enforces idempotency for duplicate transactionId", async () => {
        const requestBody = {
            transactionId: "payout_idempotent_001",
            amount: 7500.00,
            userIdentifier: "user_idempotent_001",
            paymentMethodInput: {
                methodTypeId: "UPI",
                identifiers: [
                    {
                        identifierType: "UPI_VPA",
                        identifierValue: "beneficiary@upi"
                    }
                ]
            },
            currency: "INR"
        };

        const firstResponse = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        expect(firstResponse.status).toBe(200);
        const firstResult = await firstResponse.json();

        const secondResponse = await fetch(`${baseUrl}/v1/payouts`, {
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
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: 5000.00,
                userIdentifier: "user_test_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "beneficiary@upi"
                        }
                    ]
                },
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("returns validation error for missing amount", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_003",
                userIdentifier: "user_test_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "beneficiary@upi"
                        }
                    ]
                },
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("returns validation error for missing paymentMethodInput and paymentMethodId", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_004",
                amount: 5000.00,
                userIdentifier: "user_test_001",
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("returns validation error for missing userIdentifier", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_005",
                amount: 5000.00,
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "beneficiary@upi"
                        }
                    ]
                },
            }),
        });

        expect(response.status).toBe(400);
    });

    test("returns validation error for empty identifiers array", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_006",
                amount: 5000.00,
                userIdentifier: "user_test_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: []
                },
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("returns validation error for zero or negative amount", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_007",
                amount: 0,
                userIdentifier: "user_test_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "beneficiary@upi"
                        }
                    ]
                },
            }),
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("creates payout with UPI payment method input", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_upi_001",
                amount: 3000.00,
                userIdentifier: "user_upi_001",
                paymentMethodInput: {
                    methodTypeId: "UPI",
                    identifiers: [
                        {
                            identifierType: "UPI_VPA",
                            identifierValue: "beneficiary@paytm"
                        }
                    ]
                },
                currency: "INR"
            }),
        });

        expect(response.status).toBe(200);
        const result = await response.json();

        expect(result.status).toBe("GATEWAY_INITIATED");
        expect(result.paymentMethod).toBeDefined();
        expect(result.paymentMethod.methodTypeId).toBe("UPI");
    });

    test("creates payout with bank account payment method input", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_bank_001",
                amount: 15000.00,
                userIdentifier: "user_bank_001",
                paymentMethodInput: {
                    methodTypeId: "BANK_ACCOUNT",
                    identifiers: [
                        {
                            identifierType: "BANK_ACCOUNT",
                            identifierValue: "9876543210|HDFC0001234"
                        }
                    ]
                },
                currency: "INR"
            }),
        });

        expect(response.status).toBe(200);
        const result = await response.json();

        expect(result.status).toBe("GATEWAY_INITIATED");
        expect(result.paymentMethod).toBeDefined();
        expect(result.paymentMethod.methodTypeId).toBe("BANK_ACCOUNT");
    });
});

