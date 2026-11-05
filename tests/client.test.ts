import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Revolink, RevolinkConfigError, RevolinkError, DEFAULT_BASE_URL} from '../src';

type Call = {url: string; method: string; headers: Record<string, string>; body?: unknown};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', ...headers}});

const setup = (responses: Array<Response | Error | ((call: Call) => Response)>, options: Record<string, unknown> = {}) => {
    const calls: Call[] = [];
    const queue = [...responses];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
        const call: Call = {
            url,
            method: init.method || 'GET',
            headers: init.headers as Record<string, string>,
            body: init.body ? JSON.parse(init.body as string) : undefined,
        };
        calls.push(call);
        const next = queue.shift();
        if (!next) throw new Error('unexpected request');
        if (next instanceof Error) throw next;
        return typeof next === 'function' ? next(call) : next;
    });
    const revolink = new Revolink({
        apiKey: 'rk_test', workspaceId: 'ws1', baseUrl: 'https://api.test/apiv2', fetch: fetchMock as unknown as typeof fetch, ...options,
    });
    return {revolink, calls, fetchMock};
};

const link = {id: 'l1', name: 'example.com', domain: 'rvlnk.link', slug: 'abc', shortLink: 'https://rvlnk.link/abc', active: true, clicks: 0, rules: [], abTest: {enabled: false, variants: []}, tagIds: []};

describe('setup', () => {
    it('requires an api key and a workspace', () => {
        expect(() => new Revolink({apiKey: '', workspaceId: 'w'})).toThrow(RevolinkConfigError);
        expect(() => new Revolink({apiKey: 'k', workspaceId: ''})).toThrow(RevolinkConfigError);
    });

    it('defaults to the production API', () => {
        expect(DEFAULT_BASE_URL).toBe('https://api.revolink.link/apiv2');
    });

    it('sends the key as Bearer and the workspace header on every request', async () => {
        const {revolink, calls} = setup([json(200, {data: {user: {id: 'u'}, workspace: {id: 'ws1'}, permissions: []}})]);
        await revolink.me();
        expect(calls[0]).toMatchObject({url: 'https://api.test/apiv2/me', method: 'GET'});
        expect(calls[0]!.headers).toMatchObject({Authorization: 'Bearer rk_test', 'X-Workspace-Id': 'ws1'});
    });

    it('trims a trailing slash of baseUrl', async () => {
        const {revolink, calls} = setup([json(200, {data: []})], {baseUrl: 'https://api.test/apiv2///'});
        await revolink.tags.list();
        expect(calls[0]!.url).toBe('https://api.test/apiv2/tags');
    });
});

describe('links', () => {
    it('create posts the body and returns the unwrapped link', async () => {
        const {revolink, calls} = setup([json(201, {data: link})]);
        const created = await revolink.links.create({url: 'https://example.com'});
        expect(created.shortLink).toBe('https://rvlnk.link/abc');
        expect(calls[0]).toMatchObject({method: 'POST', url: 'https://api.test/apiv2/links', body: {url: 'https://example.com'}});
        expect(calls[0]!.headers['Content-Type']).toBe('application/json');
    });

    it('get, update and delete use the id in the path (encoded)', async () => {
        const {revolink, calls} = setup([json(200, {data: link}), json(200, {data: link}), json(200, {data: {id: 'a/b'}})]);
        await revolink.links.get('l1');
        await revolink.links.update('l1', {active: false});
        await revolink.links.delete('a/b');
        expect(calls.map(c => `${c.method} ${c.url.replace('https://api.test/apiv2', '')}`)).toEqual([
            'GET /links/l1', 'PATCH /links/l1', 'DELETE /links/a%2Fb',
        ]);
        expect(calls[1]!.body).toEqual({active: false});
    });

    it('upsert is a PUT', async () => {
        const {revolink, calls} = setup([json(200, {data: link})]);
        await revolink.links.upsert({url: 'https://example.com', slug: 'abc'});
        expect(calls[0]).toMatchObject({method: 'PUT', url: 'https://api.test/apiv2/links'});
    });

    it('list builds the query: arrays joined, undefined skipped', async () => {
        const {revolink, calls} = setup([json(200, {data: [], pagination: {page: 2, limit: 10, total: 0}})]);
        await revolink.links.list({page: 2, limit: 10, search: 'pr omo', domain: ['a.io', 'b.io'], tagIds: ['t1', 't2'], active: false, sortBy: 'clicks'});
        const url = new URL(calls[0]!.url);
        expect(Object.fromEntries(url.searchParams)).toEqual({
            page: '2', limit: '10', search: 'pr omo', domain: 'a.io,b.io', tagIds: 't1,t2', active: 'false', sortBy: 'clicks',
        });
    });

    it('iterate walks every page and stops at the total', async () => {
        const item = (id: string) => ({id, name: id, domain: 'rvlnk.link', slug: id, shortLink: `https://rvlnk.link/${id}`, active: true, clicks: 0, tags: []});
        const {revolink, calls} = setup([
            json(200, {data: [item('a'), item('b')], pagination: {page: 1, limit: 2, total: 3}}),
            json(200, {data: [item('c')], pagination: {page: 2, limit: 2, total: 3}}),
        ]);
        const seen: string[] = [];
        for await (const l of revolink.links.iterate({limit: 2})) seen.push(l.id);
        expect(seen).toEqual(['a', 'b', 'c']);
        expect(calls).toHaveLength(2);
        expect(new URL(calls[1]!.url).searchParams.get('page')).toBe('2');
    });

    it('iterate asks for the biggest page by default and ends on an empty list', async () => {
        const {revolink, calls} = setup([json(200, {data: [], pagination: {page: 1, limit: 200, total: 0}})]);
        const seen = [];
        for await (const l of revolink.links.iterate()) seen.push(l);
        expect(seen).toEqual([]);
        expect(new URL(calls[0]!.url).searchParams.get('limit')).toBe('200');
    });

    it('bulk methods wrap the arrays the way the API expects', async () => {
        const {revolink, calls} = setup([
            json(200, {data: {created: [], failed: []}}),
            json(200, {data: {updated: [], failed: []}}),
            json(200, {data: {deleted: [], failed: []}}),
        ]);
        await revolink.links.createMany([{url: 'https://a.io'}]);
        await revolink.links.updateMany([{id: 'l1', active: false}]);
        await revolink.links.deleteMany(['l1', 'l2']);
        expect(calls.map(c => [c.method, c.body])).toEqual([
            ['POST', {links: [{url: 'https://a.io'}]}],
            ['PATCH', {updates: [{id: 'l1', active: false}]}],
            ['DELETE', {ids: ['l1', 'l2']}],
        ]);
    });
});

describe('tags, domains, analytics', () => {
    it('tags and domains call the right endpoints', async () => {
        const tag = {id: 't1', name: 'sale'};
        const domain = {id: 'd1', domain: 'go.example.com', status: 'pending'};
        const {revolink, calls} = setup([
            json(200, {data: [tag]}), json(201, {data: tag}), json(200, {data: tag}), json(200, {data: {id: 't1'}}),
            json(200, {data: [domain]}), json(201, {data: domain}), json(200, {data: {id: 'd1'}}),
        ]);
        await revolink.tags.list();
        await revolink.tags.create({name: 'sale'});
        await revolink.tags.update('t1', {color: '#000000'});
        await revolink.tags.delete('t1');
        await revolink.domains.list();
        await revolink.domains.create('go.example.com');
        await revolink.domains.delete('d1');
        expect(calls.map(c => `${c.method} ${c.url.replace('https://api.test/apiv2', '')}`)).toEqual([
            'GET /tags', 'POST /tags', 'PATCH /tags/t1', 'DELETE /tags/t1', 'GET /domains', 'POST /domains', 'DELETE /domains/d1',
        ]);
        expect(calls[5]!.body).toEqual({domain: 'go.example.com'});
    });

    it('analytics sends dates as YYYY-MM-DD, from a Date or a string', async () => {
        const {revolink, calls} = setup([json(200, {data: {totalClicks: 1}}), json(200, {data: {totalClicks: 2}})]);
        const stats = await revolink.analytics.link('l1', {from: new Date('2026-01-05T23:30:00Z'), to: '2026-02-01'});
        await revolink.analytics.workspace({from: '2026-01-01'});
        expect(stats).toEqual({totalClicks: 1});
        expect(new URL(calls[0]!.url).pathname).toBe('/apiv2/links/l1/analytics');
        expect(Object.fromEntries(new URL(calls[0]!.url).searchParams)).toEqual({from: '2026-01-05', to: '2026-02-01'});
        expect(Object.fromEntries(new URL(calls[1]!.url).searchParams)).toEqual({from: '2026-01-01'});
    });
});

describe('errors', () => {
    it('throws RevolinkError with status, code and message', async () => {
        const {revolink} = setup([json(404, {error: {code: 'not_found', message: 'Link not found.'}})]);
        const error = await revolink.links.get('x').catch(e => e);
        expect(error).toBeInstanceOf(RevolinkError);
        expect(error).toMatchObject({status: 404, code: 'not_found', message: 'Link not found.', licenseLimitReached: false});
    });

    it('exposes the plan limit and the missing permission', async () => {
        const limit = setup([json(403, {error: {code: 'license_limit_reached', message: 'Link limit reached.', licenseLimitReached: true}})]);
        expect(await limit.revolink.links.create({url: 'https://a.io'}).catch(e => e)).toMatchObject({status: 403, licenseLimitReached: true});
        const scope = setup([json(403, {error: {code: 'forbidden', message: 'Missing permission: tags:read', requiredPermission: 'tags:read'}})]);
        expect(await scope.revolink.tags.list().catch(e => e)).toMatchObject({requiredPermission: 'tags:read'});
    });

    it('survives a non-JSON error page', async () => {
        const {revolink} = setup([new Response('<html>Bad gateway</html>', {status: 502})], {maxRetries: 0});
        expect(await revolink.links.get('x').catch(e => e)).toMatchObject({status: 502, code: 'error'});
    });
});

describe('retries', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('retries a 429 after Retry-After, for any method', async () => {
        const {revolink, calls} = setup([
            json(429, {error: {code: 'rate_limited', message: 'Too many requests.'}}, {'Retry-After': '2'}),
            json(201, {data: link}),
        ]);
        const pending = revolink.links.create({url: 'https://a.io'});
        await vi.advanceTimersByTimeAsync(2000);
        expect((await pending).id).toBe('l1');
        expect(calls).toHaveLength(2);
    });

    it('retries a GET after a 5xx and after a network error', async () => {
        const {revolink, calls} = setup([json(503, {error: {code: 'internal_error', message: 'x'}}), new Error('socket hang up'), json(200, {data: link})]);
        const pending = revolink.links.get('l1');
        await vi.advanceTimersByTimeAsync(5000);
        expect((await pending).id).toBe('l1');
        expect(calls).toHaveLength(3);
    });

    it('does NOT repeat a POST after a 5xx or a network error (it may have been processed)', async () => {
        const first = setup([json(500, {error: {code: 'internal_error', message: 'boom'}})]);
        await expect(first.revolink.links.create({url: 'https://a.io'})).rejects.toMatchObject({status: 500});
        expect(first.calls).toHaveLength(1);

        const second = setup([new Error('socket hang up')]);
        await expect(second.revolink.links.create({url: 'https://a.io'})).rejects.toMatchObject({status: 0, code: 'network_error'});
        expect(second.calls).toHaveLength(1);
    });

    it('gives up after maxRetries and reports retryAfter', async () => {
        const body = {error: {code: 'rate_limited', message: 'Too many requests.'}};
        const {revolink, calls} = setup([json(429, body, {'Retry-After': '1'}), json(429, body, {'Retry-After': '1'})], {maxRetries: 1});
        const pending = revolink.tags.list().catch(e => e);
        await vi.advanceTimersByTimeAsync(3000);
        expect(await pending).toMatchObject({status: 429, code: 'rate_limited', retryAfter: 1});
        expect(calls).toHaveLength(2);
    });

    it('maxRetries: 0 turns retries off', async () => {
        const {revolink, calls} = setup([json(429, {error: {code: 'rate_limited', message: 'x'}})], {maxRetries: 0});
        await expect(revolink.tags.list()).rejects.toMatchObject({status: 429});
        expect(calls).toHaveLength(1);
    });

    it('times out a request that never answers', async () => {
        const hang = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
            init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), {name: 'AbortError'})));
        }));
        const revolink = new Revolink({apiKey: 'k', workspaceId: 'w', fetch: hang as unknown as typeof fetch, timeout: 1000, maxRetries: 0});
        const pending = revolink.links.create({url: 'https://a.io'}).catch(e => e);
        await vi.advanceTimersByTimeAsync(1000);
        expect(await pending).toMatchObject({status: 0, code: 'network_error', message: 'Request timed out after 1000 ms.'});
    });
});
