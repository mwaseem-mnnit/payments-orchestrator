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
                paymentMethod: "UPI",
                beneficiaryDetails: {
                    upiId: "beneficiary@upi",
                },
            }),
        });

        expect(response.status).toBe(200);

        const result = await response.json();

        expect(result).toMatchObject({
            transactionId: "payout_test_001",
            amount: 5000.00,
            paymentMethod: "UPI",
            currency: "INR",
            status: "GATEWAY_INITIATED",
        });

        expect(result.paymentIntentId).toBeDefined();
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
                paymentMethod: "BANK_TRANSFER",
                currency: "USD",
                userIdentifier: "user_payout_002",
                customerData: {
                    name: "Jane Doe",
                    email: "jane@example.com",
                },
                beneficiaryDetails: {
                    accountNumber: "1234567890",
                    ifsc: "SBIN0001234",
                    bankName: "State Bank of India",
                },
                paymentGateway: "CASHFREE",
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
            paymentMethod: "BANK_TRANSFER",
            currency: "USD",
            status: "GATEWAY_INITIATED",
            gateway: "CASHFREE",
        });

        expect(result.paymentIntentId).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
    });

    test("enforces idempotency for duplicate transactionId", async () => {
        const requestBody = {
            transactionId: "payout_idempotent_001",
            amount: 7500.00,
            paymentMethod: "UPI",
            beneficiaryDetails: {
                upiId: "beneficiary@upi",
            },
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
                paymentMethod: "UPI",
                beneficiaryDetails: {
                    upiId: "beneficiary@upi",
                },
            }),
        });

        expect(response.status).toBe(500);
    });

    test("returns validation error for missing amount", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_003",
                paymentMethod: "UPI",
                beneficiaryDetails: {
                    upiId: "beneficiary@upi",
                },
            }),
        });

        expect(response.status).toBe(500);
    });

    test("returns validation error for missing paymentMethod", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_004",
                amount: 5000.00,
                beneficiaryDetails: {
                    upiId: "beneficiary@upi",
                },
            }),
        });

        expect(response.status).toBe(500);
    });

    test("returns validation error for missing beneficiaryDetails", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_005",
                amount: 5000.00,
                paymentMethod: "UPI",
            }),
        });

        expect(response.status).toBe(500);
    });

    test("returns validation error for empty beneficiaryDetails", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_test_006",
                amount: 5000.00,
                paymentMethod: "UPI",
                beneficiaryDetails: {},
            }),
        });

        expect(response.status).toBe(500);
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
                paymentMethod: "UPI",
                beneficiaryDetails: {
                    upiId: "beneficiary@upi",
                },
            }),
        });

        expect(response.status).toBe(500);
    });

    test("creates payout with UPI beneficiary details", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_upi_001",
                amount: 3000.00,
                paymentMethod: "UPI",
                beneficiaryDetails: {
                    upiId: "beneficiary@paytm",
                },
            }),
        });

        expect(response.status).toBe(200);
        const result = await response.json();

        expect(result.status).toBe("GATEWAY_INITIATED");
        expect(result.paymentMethod).toBe("UPI");
    });

    test("creates payout with bank account beneficiary details", async () => {
        const response = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_bank_001",
                amount: 15000.00,
                paymentMethod: "BANK_TRANSFER",
                beneficiaryDetails: {
                    accountNumber: "9876543210",
                    ifsc: "HDFC0001234",
                    bankName: "HDFC Bank",
                },
            }),
        });

        expect(response.status).toBe(200);
        const result = await response.json();

        expect(result.status).toBe("GATEWAY_INITIATED");
        expect(result.paymentMethod).toBe("BANK_TRANSFER");
    });
});

