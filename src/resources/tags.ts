import type {HttpClient} from '../http';
import type {Tag, TagCreate, TagUpdate} from '../types';

const enc = encodeURIComponent;

export class Tags {
    constructor(private readonly http: HttpClient) {}

    /** All tags of the workspace. Needs `tags:read`. */
    async list(): Promise<Tag[]> {
        return (await this.http.request<{data: Tag[]}>('GET', '/tags')).data;
    }

    /** Needs `tags:read`. */
    async get(id: string): Promise<Tag> {
        return (await this.http.request<{data: Tag}>('GET', `/tags/${enc(id)}`)).data;
    }

    /** Needs `tags:write`. Throws a `conflict` error when the name is taken. */
    async create(input: TagCreate): Promise<Tag> {
        return (await this.http.request<{data: Tag}>('POST', '/tags', {body: input})).data;
    }

    /** Needs `tags:write`. */
    async update(id: string, input: TagUpdate): Promise<Tag> {
        return (await this.http.request<{data: Tag}>('PATCH', `/tags/${enc(id)}`, {body: input})).data;
    }

    /** The tag is removed from all links. Needs `tags:delete`. */
    async delete(id: string): Promise<{id: string}> {
        return (await this.http.request<{data: {id: string}}>('DELETE', `/tags/${enc(id)}`)).data;
    }
}
