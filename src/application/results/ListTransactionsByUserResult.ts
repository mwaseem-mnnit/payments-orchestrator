import { FetchTransactionStatusResult } from "./FetchTransactionStatusResult";

export class ListTransactionsByUserResult {
    constructor(
        public readonly transactions: FetchTransactionStatusResult[],
        public readonly pageSize: number,
        public readonly pageToken?: string,
        public readonly nextPageToken?: string
    ) {}
}

