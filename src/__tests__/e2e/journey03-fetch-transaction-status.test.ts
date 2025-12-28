import { TestServer } from "./TestServer";

describe("Journey 03: Fetch Transaction Status", () => {
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

    test("fetches transaction status for existing payment intent", async () => {
        const createResponse = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_fetch_001",
                amount: 2000.00,
                paymentMethod: "UPI",
                userIdentifier: "user_fetch_001",
            }),
        });

        expect(createResponse.status).toBe(200);
        const createResult = await createResponse.json();
        const transactionId = createResult.transactionId;

        const fetchResponse = await fetch(
            `${baseUrl}/v1/transactions/${transactionId}`
        );

        expect(fetchResponse.status).toBe(200);

        const fetchResult = await fetchResponse.json();

        expect(fetchResult).toMatchObject({
            transactionId: transactionId,
            paymentIntentId: createResult.paymentIntentId,
            paymentFlowType: "PAYIN",
            paymentMethod: "UPI",
            status: "GATEWAY_INITIATED",
            amount: 2000.00,
            currency: "INR",
        });

        expect(fetchResult.gateway).toBeDefined();
        expect(fetchResult.createdAt).toBeDefined();
        expect(fetchResult.updatedAt).toBeDefined();
    });

    test("fetches transaction status with gateway metadata", async () => {
        const createResponse = await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_fetch_002",
                amount: 3500.25,
                paymentMethod: "CARD",
                userIdentifier: "user_fetch_002",
                additionalAttributes: {
                    maskedUpiId: "test@upi",
                    cardLast4: "1234",
                },
            }),
        });

        expect(createResponse.status).toBe(200);
        const createResult = await createResponse.json();

        const fetchResponse = await fetch(
            `${baseUrl}/v1/transactions/${createResult.transactionId}`
        );

        expect(fetchResponse.status).toBe(200);
        const fetchResult = await fetchResponse.json();

        expect(fetchResult.transactionId).toBe(createResult.transactionId);
        expect(fetchResult.gatewayMetadata).toBeDefined();
    });

    test("returns error for non-existent transaction", async () => {
        const fetchResponse = await fetch(
            `${baseUrl}/v1/transactions/non_existent_txn`
        );

        expect(fetchResponse.status).toBe(500);
    });

    test("fetches payout transaction status", async () => {
        const createResponse = await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "payout_fetch_001",
                amount: 5000.00,
                paymentMethod: "UPI",
                userIdentifier: "user_payout_001",
                beneficiaryDetails: {
                    upiId: "beneficiary@upi",
                },
            }),
        });

        expect(createResponse.status).toBe(200);
        const createResult = await createResponse.json();

        const fetchResponse = await fetch(
            `${baseUrl}/v1/transactions/${createResult.transactionId}`
        );

        expect(fetchResponse.status).toBe(200);
        const fetchResult = await fetchResponse.json();

        expect(fetchResult).toMatchObject({
            transactionId: createResult.transactionId,
            paymentFlowType: "PAYOUT",
            status: "GATEWAY_INITIATED",
            amount: 5000.00,
        });
    });
});

