import type {HttpClient} from '../http';
import type {Domain} from '../types';

const enc = encodeURIComponent;

export class Domains {
    constructor(private readonly http: HttpClient) {}

    /** All custom domains of the workspace. Needs `domains:read`. */
    async list(): Promise<Domain[]> {
        return (await this.http.request<{data: Domain[]}>('GET', '/domains')).data;
    }

    /** Needs `domains:read`. */
    async get(id: string): Promise<Domain> {
        return (await this.http.request<{data: Domain}>('GET', `/domains/${enc(id)}`)).data;
    }

    /**
     * Adds a domain. It starts as `pending`: create the DNS record described in `verification` and it becomes `verified`.
     * Needs `domains:write`.
     */
    async create(domain: string): Promise<Domain> {
        return (await this.http.request<{data: Domain}>('POST', '/domains', {body: {domain}})).data;
    }

    /** Needs `domains:delete`. */
    async delete(id: string): Promise<{id: string}> {
        return (await this.http.request<{data: {id: string}}>('DELETE', `/domains/${enc(id)}`)).data;
    }
}
