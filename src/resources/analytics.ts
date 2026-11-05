import type {HttpClient} from '../http';
import type {Analytics, AnalyticsParams} from '../types';

const enc = encodeURIComponent;

// A Date is sent as its UTC calendar day; a string is passed as given (YYYY-MM-DD).
const day = (value: Date | string) => (value instanceof Date ? value.toISOString().slice(0, 10) : value);

const toQuery = ({from, to}: AnalyticsParams) => ({from: day(from), to: to === undefined ? undefined : day(to)});

export class AnalyticsResource {
    constructor(private readonly http: HttpClient) {}

    /** Click statistics of one link. Needs `analytics:read`. */
    async link(id: string, params: AnalyticsParams): Promise<Analytics> {
        return (await this.http.request<{data: Analytics}>('GET', `/links/${enc(id)}/analytics`, {query: toQuery(params)})).data;
    }

    /** Click statistics of the whole workspace. Needs `analytics:read`. */
    async workspace(params: AnalyticsParams): Promise<Analytics> {
        return (await this.http.request<{data: Analytics}>('GET', '/analytics', {query: toQuery(params)})).data;
    }
}
