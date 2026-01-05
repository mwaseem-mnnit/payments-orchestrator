export interface PaginatedResult<T> {
    items: T[];
    pageSize: number;
    pageToken?: string;
    nextPageToken?: string;
}

