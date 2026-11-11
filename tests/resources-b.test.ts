import {describe, expect, it, vi} from 'vitest';
import {Revolink} from '../src';

type Call = {url: string; method: string; headers: Record<string, string>; body?: unknown; rawBody?: unknown};

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

const setup = (response: Response) => {
    const calls: Call[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
        calls.push({
            url,
            method: init.method || 'GET',
            headers: init.headers as Record<string, string>,
            body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
            rawBody: init.body,
        });
        return response.clone();
    });
    const revolink = new Revolink({apiKey: 'rk', workspaceId: 'ws1', baseUrl: 'https://api.test/apiv2', fetch: fetchMock as unknown as typeof fetch});
    return {revolink, calls};
};

describe('files', () => {
    it('uploads a blob as multipart without a JSON content type', async () => {
        const {revolink, calls} = setup(json(200, {data: {url: 'https://cdn.test/uploads/a.png'}}));
        const result = await revolink.files.upload(new Blob(['x'], {type: 'image/png'}), 'a.png');

        expect(result).toEqual({url: 'https://cdn.test/uploads/a.png'});
        expect(calls[0]).toMatchObject({url: 'https://api.test/apiv2/files', method: 'POST'});
        expect(calls[0]!.rawBody).toBeInstanceOf(FormData);
        expect((calls[0]!.rawBody as FormData).get('file')).toBeInstanceOf(Blob);
        expect(calls[0]!.headers['Content-Type']).toBeUndefined();
        expect(calls[0]!.headers).toMatchObject({Authorization: 'Bearer rk', 'X-Workspace-Id': 'ws1'});
    });
});

describe('templates', () => {
    it('lists UTM templates', async () => {
        const template = {id: 't1', name: 'Spring', content: {source: 'news'}};
        const {revolink, calls} = setup(json(200, {data: [template]}));
        expect(await revolink.templates.list()).toEqual([template]);
        expect(calls[0]).toMatchObject({url: 'https://api.test/apiv2/templates?type=utm', method: 'GET'});
    });
});

describe('link history and public statistics', () => {
    it('reads the activity page', async () => {
        const page = {data: [{id: 'a1', action: 'link_updated', user: {fullname: 'A'}}], pagination: {page: 2, limit: 5, total: 9}};
        const {revolink, calls} = setup(json(200, page));
        expect(await revolink.links.activity('l1', {page: 2, limit: 5})).toEqual(page);
        expect(calls[0]!.url).toBe('https://api.test/apiv2/links/l1/activity?page=2&limit=5');
    });

    it('creates, changes, lists and deletes a share', async () => {
        const share = {id: 's1', linkId: 'l1', name: 'Client', enabledGraphs: {geo: true}, token: 't', url: 'https://app/public/s/t'};

        let ctx = setup(json(201, {data: share}));
        expect(await ctx.revolink.links.createShare('l1', {name: 'Client', enabledGraphs: {geo: true}})).toEqual(share);
        expect(ctx.calls[0]).toMatchObject({url: 'https://api.test/apiv2/links/l1/shares', method: 'POST', body: {name: 'Client', enabledGraphs: {geo: true}}});

        ctx = setup(json(200, {data: share}));
        await ctx.revolink.links.updateShare('s1', {name: 'Renamed'});
        expect(ctx.calls[0]).toMatchObject({url: 'https://api.test/apiv2/shares/s1', method: 'PATCH', body: {name: 'Renamed'}});

        ctx = setup(json(200, {data: [share]}));
        expect(await ctx.revolink.links.listShares('l1')).toEqual([share]);

        ctx = setup(json(200, {data: {id: 's1'}}));
        expect(await ctx.revolink.links.deleteShare('s1')).toEqual({id: 's1'});
        expect(ctx.calls[0]).toMatchObject({url: 'https://api.test/apiv2/shares/s1', method: 'DELETE'});
    });
});
