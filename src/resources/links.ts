import type {HttpClient} from '../http';
import type {
    BulkCreateResult, BulkDeleteResult, BulkUpdateResult, Link, LinkCreate, LinkSummary, LinkUpdate, ListLinksParams, Page,
} from '../types';

const MAX_PAGE_SIZE = 200;
const enc = encodeURIComponent;

export class Links {
    constructor(private readonly http: HttpClient) {}

    /**
     * Creates a link. Pass `url` for one destination, or `rules` for smart routing.
     * Needs the `links:write` permission.
     * @example
     * const {shortLink} = await revolink.links.create({url: 'https://example.com'});
     */
    async create(input: LinkCreate): Promise<Link> {
        return (await this.http.request<{data: Link}>('POST', '/links', {body: input})).data;
    }

    /** Creates the link, or updates the one that already has this `slug` on this `domain`. Needs `links:write`. */
    async upsert(input: LinkCreate & {slug: string}): Promise<Link> {
        return (await this.http.request<{data: Link}>('PUT', '/links', {body: input})).data;
    }

    /** Needs `links:read`. */
    async get(id: string): Promise<Link> {
        return (await this.http.request<{data: Link}>('GET', `/links/${enc(id)}`)).data;
    }

    /** One page of links. Needs `links:read`. */
    async list(params: ListLinksParams = {}): Promise<Page<LinkSummary>> {
        const {domain, ...rest} = params;
        return this.http.request<Page<LinkSummary>>('GET', '/links', {
            query: {...rest, domain: Array.isArray(domain) ? domain.join(',') : domain},
        });
    }

    /**
     * Walks through every link that matches, page after page.
     * @example
     * for await (const link of revolink.links.iterate({search: 'promo'})) console.log(link.shortLink);
     */
    async *iterate(params: Omit<ListLinksParams, 'page'> = {}): AsyncGenerator<LinkSummary, void, undefined> {
        const limit = Math.min(params.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
        for (let page = 1; ; page += 1) {
            const result = await this.list({...params, limit, page});
            yield* result.data;
            if (page * result.pagination.limit >= result.pagination.total || result.data.length === 0) return;
        }
    }

    /** Send only what changes. `url` replaces the destination of the default rule. Needs `links:write`. */
    async update(id: string, input: LinkUpdate): Promise<Link> {
        return (await this.http.request<{data: Link}>('PATCH', `/links/${enc(id)}`, {body: input})).data;
    }

    /** Permanent. Needs `links:delete`. */
    async delete(id: string): Promise<{id: string}> {
        return (await this.http.request<{data: {id: string}}>('DELETE', `/links/${enc(id)}`)).data;
    }

    /** Up to 100 links in one request; one failing item does not stop the others. Needs `links:bulk`. */
    async createMany(links: LinkCreate[]): Promise<BulkCreateResult> {
        return (await this.http.request<{data: BulkCreateResult}>('POST', '/links/bulk', {body: {links}})).data;
    }

    /** Up to 100 links in one request. Needs `links:bulk`. */
    async updateMany(updates: Array<LinkUpdate & {id: string}>): Promise<BulkUpdateResult> {
        return (await this.http.request<{data: BulkUpdateResult}>('PATCH', '/links/bulk', {body: {updates}})).data;
    }

    /** Up to 100 links in one request. Permanent. Needs `links:bulk`. */
    async deleteMany(ids: string[]): Promise<BulkDeleteResult> {
        return (await this.http.request<{data: BulkDeleteResult}>('DELETE', '/links/bulk', {body: {ids}})).data;
    }
}
