import { TestServer } from "./TestServer";

describe("Journey 04: List Transactions by User", () => {
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

    test("lists transactions for user with minimal query", async () => {
        const userIdentifier = "user_list_001";

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_001",
                amount: 1000.00,
                paymentMethod: "UPI",
                userIdentifier: userIdentifier,
            }),
        });

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_002",
                amount: 2000.00,
                paymentMethod: "CARD",
                userIdentifier: userIdentifier,
            }),
        });

        const listResponse = await fetch(
            `${baseUrl}/v1/transactions?userIdentifier=${userIdentifier}`
        );

        expect(listResponse.status).toBe(200);

        const listResult = await listResponse.json();

        expect(listResult).toMatchObject({
            transactions: expect.any(Array),
            pageSize: 20,
        });

        expect(listResult.transactions.length).toBeGreaterThanOrEqual(2);
        expect(listResult.transactions[0]).toMatchObject({
            transactionId: expect.any(String),
            paymentIntentId: expect.any(String),
            paymentFlowType: "PAYIN",
            paymentMethod: expect.any(String),
            status: expect.any(String),
            amount: expect.any(Number),
            currency: expect.any(String),
        });
    });

    test("filters transactions by payment flow type", async () => {
        const userIdentifier = "user_list_002";

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_payin_001",
                amount: 1000.00,
                paymentMethod: "UPI",
                userIdentifier: userIdentifier,
            }),
        });

        await fetch(`${baseUrl}/v1/payouts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_payout_001",
                amount: 5000.00,
                paymentMethod: "UPI",
                userIdentifier: userIdentifier,
                beneficiaryDetails: {
                    upiId: "beneficiary@upi",
                },
            }),
        });

        const listResponse = await fetch(
            `${baseUrl}/v1/transactions?userIdentifier=${userIdentifier}&paymentFlowType=PAYIN`
        );

        expect(listResponse.status).toBe(200);
        const listResult = await listResponse.json();

        expect(listResult.transactions.length).toBeGreaterThanOrEqual(1);
        listResult.transactions.forEach((txn: any) => {
            expect(txn.paymentFlowType).toBe("PAYIN");
        });
    });

    test("filters transactions by payment method", async () => {
        const userIdentifier = "user_list_003";

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_pm_upi",
                amount: 1000.00,
                paymentMethod: "UPI",
                userIdentifier: userIdentifier,
            }),
        });

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_pm_card",
                amount: 2000.00,
                paymentMethod: "CARD",
                userIdentifier: userIdentifier,
            }),
        });

        const listResponse = await fetch(
            `${baseUrl}/v1/transactions?userIdentifier=${userIdentifier}&paymentMethod=UPI`
        );

        expect(listResponse.status).toBe(200);
        const listResult = await listResponse.json();

        expect(listResult.transactions.length).toBeGreaterThanOrEqual(1);
        listResult.transactions.forEach((txn: any) => {
            expect(txn.paymentMethod).toBe("UPI");
        });
    });

    test("filters transactions by amount range", async () => {
        const userIdentifier = "user_list_004";

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_amt_001",
                amount: 500.00,
                paymentMethod: "UPI",
                userIdentifier: userIdentifier,
            }),
        });

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_amt_002",
                amount: 5000.00,
                paymentMethod: "UPI",
                userIdentifier: userIdentifier,
            }),
        });

        const listResponse = await fetch(
            `${baseUrl}/v1/transactions?userIdentifier=${userIdentifier}&minAmount=1000&maxAmount=3000`
        );

        expect(listResponse.status).toBe(200);
        const listResult = await listResponse.json();

        listResult.transactions.forEach((txn: any) => {
            expect(txn.amount).toBeGreaterThanOrEqual(1000);
            expect(txn.amount).toBeLessThanOrEqual(3000);
        });
    });

    test("supports pagination", async () => {
        const userIdentifier = "user_list_005";

        for (let i = 1; i <= 5; i++) {
            await fetch(`${baseUrl}/v1/payment-intents`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    transactionId: `txn_list_pg_${i}`,
                    amount: 1000.00 * i,
                    paymentMethod: "UPI",
                    userIdentifier: userIdentifier,
                }),
            });
        }

        const listResponse = await fetch(
            `${baseUrl}/v1/transactions?userIdentifier=${userIdentifier}&pageSize=2`
        );

        expect(listResponse.status).toBe(200);
        const listResult = await listResponse.json();

        expect(listResult.transactions.length).toBeLessThanOrEqual(2);
        expect(listResult.pageSize).toBe(2);

        if (listResult.nextPageToken) {
            const nextPageResponse = await fetch(
                `${baseUrl}/v1/transactions?userIdentifier=${userIdentifier}&pageSize=2&pageToken=${listResult.nextPageToken}`
            );

            expect(nextPageResponse.status).toBe(200);
            const nextPageResult = await nextPageResponse.json();
            expect(nextPageResult.transactions.length).toBeGreaterThan(0);
        }
    });

    test("sorts transactions by createdAt descending by default", async () => {
        const userIdentifier = "user_list_006";

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_sort_001",
                amount: 1000.00,
                paymentMethod: "UPI",
                userIdentifier: userIdentifier,
            }),
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        await fetch(`${baseUrl}/v1/payment-intents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transactionId: "txn_list_sort_002",
                amount: 2000.00,
                paymentMethod: "UPI",
                userIdentifier: userIdentifier,
            }),
        });

        const listResponse = await fetch(
            `${baseUrl}/v1/transactions?userIdentifier=${userIdentifier}`
        );

        expect(listResponse.status).toBe(200);
        const listResult = await listResponse.json();

        if (listResult.transactions.length >= 2) {
            const first = new Date(listResult.transactions[0].createdAt).getTime();
            const second = new Date(listResult.transactions[1].createdAt).getTime();
            expect(first).toBeGreaterThanOrEqual(second);
        }
    });

    test("returns empty list for user with no transactions", async () => {
        const listResponse = await fetch(
            `${baseUrl}/v1/transactions?userIdentifier=user_no_txns`
        );

        expect(listResponse.status).toBe(200);
        const listResult = await listResponse.json();

        expect(listResult.transactions).toEqual([]);
        expect(listResult.pageSize).toBe(20);
    });

    test("returns validation error for missing userIdentifier", async () => {
        const listResponse = await fetch(`${baseUrl}/v1/transactions`);

        expect(listResponse.status).toBeGreaterThanOrEqual(400);
    });
});

