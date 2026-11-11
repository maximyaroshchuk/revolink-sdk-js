import {RevolinkConfigError, RevolinkError} from './errors';

export const DEFAULT_BASE_URL = 'https://api.revolink.link/apiv2';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_BACKOFF_MS = 8_000;
const IDEMPOTENT = new Set(['GET', 'PUT', 'DELETE']);

export interface RevolinkOptions {
    /** An API key created in Revolink (Profile → API). */
    apiKey: string;
    /** The workspace every request works in. */
    workspaceId: string;
    /** Defaults to the production API. */
    baseUrl?: string;
    /** Per-attempt timeout in milliseconds. Default 30000. */
    timeout?: number;
    /** Retries on 429, network errors and (for GET/PUT/DELETE) 5xx. Default 2; 0 turns retries off. */
    maxRetries?: number;
    /** A custom fetch (tests, proxies, older runtimes). Defaults to the global one. */
    fetch?: typeof fetch;
}

export type QueryValue = string | number | boolean | undefined | null | Array<string | number>;

export interface RequestOptions {
    query?: Record<string, QueryValue>;
    body?: unknown;
    /** A multipart upload. The Content-Type (with its boundary) is set by `fetch`, never by us. */
    form?: FormData;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const buildQuery = (query?: Record<string, QueryValue>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query || {})) {
        if (value === undefined || value === null) continue;
        params.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    const text = params.toString();
    return text ? `?${text}` : '';
};

export class HttpClient {
    private readonly apiKey: string;
    private readonly workspaceId?: string;
    private readonly baseUrl: string;
    private readonly timeout: number;
    private readonly maxRetries: number;
    private readonly fetchImpl: typeof fetch;

    /** `requireWorkspace: false` is for the one call that happens before a workspace is chosen (listing them). */
    constructor(options: Omit<RevolinkOptions, 'workspaceId'> & {workspaceId?: string}, requireWorkspace = true) {
        if (!options?.apiKey) throw new RevolinkConfigError('apiKey is required.');
        if (requireWorkspace && !options.workspaceId) throw new RevolinkConfigError('workspaceId is required.');
        this.apiKey = options.apiKey;
        this.workspaceId = options.workspaceId;
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
        this.maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
        const impl = options.fetch || globalThis.fetch;
        if (!impl) throw new RevolinkConfigError('No fetch available: use Node 18+ or pass the `fetch` option.');
        this.fetchImpl = impl.bind(globalThis);
    }

    async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
        const url = `${this.baseUrl}${path}${buildQuery(options.query)}`;
        const init: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                ...(this.workspaceId ? {'X-Workspace-Id': this.workspaceId} : {}),
                Accept: 'application/json',
                ...(options.body !== undefined && !options.form ? {'Content-Type': 'application/json'} : {}),
            },
            body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
        };

        for (let attempt = 0; ; attempt += 1) {
            const canRetry = attempt < this.maxRetries;
            let response: Response;
            try {
                response = await this.send(url, init);
            } catch (cause) {
                // The request may or may not have been processed: only repeat what is safe to repeat.
                if (canRetry && IDEMPOTENT.has(method)) {
                    await sleep(this.backoff(attempt));
                    continue;
                }
                const message = cause instanceof Error && cause.name === 'AbortError'
                    ? `Request timed out after ${this.timeout} ms.`
                    : `Network error: ${cause instanceof Error ? cause.message : String(cause)}`;
                throw new RevolinkError(0, {code: 'network_error', message});
            }

            if (response.ok) return (await this.parse(response)) as T;

            const retryAfter = Number(response.headers.get('retry-after')) || undefined;
            const retriable = response.status === 429 || (response.status >= 500 && IDEMPOTENT.has(method));
            if (canRetry && retriable) {
                await sleep(retryAfter ? Math.min(retryAfter * 1000, MAX_BACKOFF_MS) : this.backoff(attempt));
                continue;
            }
            throw await this.toError(response, retryAfter);
        }
    }

    private async send(url: string, init: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            return await this.fetchImpl(url, {...init, signal: controller.signal});
        } finally {
            clearTimeout(timer);
        }
    }

    private backoff(attempt: number) {
        return Math.min(500 * 2 ** attempt, MAX_BACKOFF_MS);
    }

    private async parse(response: Response): Promise<unknown> {
        if (response.status === 204) return undefined;
        const text = await response.text();
        return text ? JSON.parse(text) : undefined;
    }

    private async toError(response: Response, retryAfter?: number): Promise<RevolinkError> {
        let details: {code?: string; message?: string; [key: string]: unknown} = {};
        try {
            const body = (await response.json()) as {error?: unknown};
            if (body?.error && typeof body.error === 'object') details = body.error as typeof details;
            else if (typeof body?.error === 'string') details = {message: body.error};
        } catch {
            // not JSON (a proxy page): keep the status only
        }
        return new RevolinkError(response.status, details, retryAfter);
    }
}
