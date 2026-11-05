# Revolink TypeScript SDK

Create and manage short links, tags and custom domains, and read click analytics, from Node.js, edge runtimes and the browser-side build tools you already use.

```bash
npm install revolink
```

Requires Node 18+ (or any runtime with a global `fetch`). No dependencies.

## Quickstart

1. In Revolink open **Profile → API** and create an API key. Pick the permissions the key needs.
2. Copy the id of your workspace (it is sent with every request).

```ts
import {Revolink} from 'revolink';

const revolink = new Revolink({
    apiKey: process.env.REVOLINK_API_KEY!,
    workspaceId: process.env.REVOLINK_WORKSPACE_ID!,
});

const {shortLink} = await revolink.links.create({url: 'https://example.com'});
console.log(shortLink); // https://rvlnk.link/k3x9a
```

Keep the key on your server. Anyone who has it can act on your workspace within the key's permissions.

## Links

```ts
// Create. `name` defaults to the host of the URL; `slug` is generated when omitted.
const link = await revolink.links.create({
    url: 'https://example.com/spring-sale',
    slug: 'spring',
    domain: 'go.example.com',      // a verified domain of the workspace, default rvlnk.link
    tagIds: ['…'],
    expirationDate: '2026-12-31T23:59:59Z',
});

// Smart routing: different destinations by country, device, time… (exactly one default rule)
await revolink.links.create({
    name: 'App download',
    rules: [
        {isDefault: true, targetUrl: 'https://example.com/download'},
        {isDefault: false, targetUrl: 'https://apps.apple.com/app/id1', device: ['mobile'], os: ['iOS']},
    ],
});

await revolink.links.get(link.id);
await revolink.links.update(link.id, {url: 'https://example.com/summer-sale', active: true});
await revolink.links.upsert({slug: 'spring', url: 'https://example.com/spring'}); // create or update by slug
await revolink.links.delete(link.id);

// List one page…
const page = await revolink.links.list({search: 'sale', sortBy: 'clicks', order: 'desc', limit: 50});
page.data;        // LinkSummary[]
page.pagination;  // {page, limit, total}

// …or walk through all of them
for await (const l of revolink.links.iterate({domain: 'go.example.com'})) {
    console.log(l.shortLink, l.clicks);
}

// Up to 100 at a time; one failing item does not stop the rest
const {created, failed} = await revolink.links.createMany([{url: 'https://a.io'}, {url: 'https://b.io'}]);
await revolink.links.updateMany([{id: created[0]!.id, active: false}]);
await revolink.links.deleteMany(created.map((l) => l.id));
```

`update` takes only the fields that change. `url` replaces the destination of the default rule; `rules`, when sent, replace **all** rules (keep each rule's `id` to preserve its statistics).

## Tags and domains

```ts
const tag = await revolink.tags.create({name: 'spring', color: '#29CC97'});
await revolink.tags.update(tag.id, {name: 'spring-2026'});
await revolink.tags.list();
await revolink.tags.delete(tag.id);

const domain = await revolink.domains.create('go.example.com');
domain.status;        // 'pending' until the DNS record in `domain.verification` exists
await revolink.domains.list();
await revolink.domains.delete(domain.id);
```

## Analytics

```ts
const perLink = await revolink.analytics.link(link.id, {from: '2026-10-01', to: '2026-10-31'});
const workspace = await revolink.analytics.workspace({from: new Date(Date.now() - 7 * 864e5)});
```

`from` is required (a `Date` or `YYYY-MM-DD`); the earliest available day is 2025-01-01.

## Errors

Every failed request throws a `RevolinkError`.

```ts
import {RevolinkError} from 'revolink';

try {
    await revolink.links.create({url: 'https://example.com', slug: 'taken'});
} catch (error) {
    if (error instanceof RevolinkError) {
        error.status;               // 409
        error.code;                 // 'conflict'
        error.message;              // 'This slug is already taken.'
        error.licenseLimitReached;  // true when the plan's limit stopped the request
        error.requiredPermission;   // set when the key lacks a permission, e.g. 'tags:write'
        error.retryAfter;           // seconds, on 429
    }
}
```

| `code` | Meaning |
|---|---|
| `invalid_request` | The request is wrong (400). `message` says what. |
| `unauthorized` | No key, or an invalid / expired key (401). |
| `forbidden` | The key lacks a permission, or your role cannot do this (403). |
| `license_limit_reached` | The plan's limit is reached: links, tags, domains or API calls (403). |
| `not_found` | No such item in this workspace (404). |
| `conflict` | Already exists, e.g. a taken slug or tag name (409). |
| `rate_limited` | More than 300 requests a minute for the key (429). |
| `network_error` | No answer: network failure or timeout (`status` is 0). |

## Options

```ts
new Revolink({
    apiKey, workspaceId,
    baseUrl: 'https://api.revolink.link/apiv2', // default
    timeout: 30_000,                            // ms per attempt
    maxRetries: 2,                              // 0 turns retries off
    fetch: customFetch,                         // optional
});
```

Retries: a `429` is always retried (after `Retry-After`). Network errors and `5xx` are retried only for `GET`, `PUT` and `DELETE`; a `POST` or `PATCH` that may have been processed is never repeated, so a link is not created twice.

## Permissions

| Method | Permission |
|---|---|
| `links.list`, `links.get`, `links.iterate` | `links:read` |
| `links.create`, `links.upsert`, `links.update` | `links:write` |
| `links.delete` | `links:delete` |
| `links.createMany`, `updateMany`, `deleteMany` | `links:bulk` |
| `analytics.*` | `analytics:read` |
| `tags.list`, `tags.get` / `tags.create`, `tags.update` / `tags.delete` | `tags:read` / `tags:write` / `tags:delete` |
| `domains.list`, `domains.get` / `domains.create` / `domains.delete` | `domains:read` / `domains:write` / `domains:delete` |
| `me` | any valid key |

## API reference

The interactive reference is at `https://api.revolink.link/apiv2/docs`; the OpenAPI 3.1 spec is at `https://api.revolink.link/apiv2/openapi.json`.

## Development

```bash
npm install
npm run sync-spec   # refresh openapi.yaml from the backend
npm run generate    # regenerate src/generated/schema.ts from it
npm test
npm run build
```
