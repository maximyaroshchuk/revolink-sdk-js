/** Thrown for every non-2xx answer of the API. */
export class RevolinkError extends Error {
    /** HTTP status; 0 when the request never got an answer (network error, timeout). */
    readonly status: number;
    /** Machine-readable code, e.g. `not_found`, `forbidden`, `conflict`, `license_limit_reached`, `rate_limited`. */
    readonly code: string;
    /** True when the plan's limit stopped the request (links, tags, domains or API calls per month). */
    readonly licenseLimitReached: boolean;
    /** The scope the key lacks, when the error is a missing permission. */
    readonly requiredPermission?: string;
    /** Seconds to wait before retrying, when the API said so (429). */
    readonly retryAfter?: number;
    /** The whole `error` object of the answer. */
    readonly details: Record<string, unknown>;

    constructor(status: number, details: {code?: string; message?: string; [key: string]: unknown}, retryAfter?: number) {
        super(details.message || `Request failed with status ${status}`);
        this.name = 'RevolinkError';
        this.status = status;
        this.code = details.code || 'error';
        this.licenseLimitReached = details.licenseLimitReached === true;
        this.requiredPermission = typeof details.requiredPermission === 'string' ? details.requiredPermission : undefined;
        this.retryAfter = retryAfter;
        this.details = details;
    }
}

/** Thrown when the client is set up wrongly (no API key, no workspace). */
export class RevolinkConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RevolinkConfigError';
    }
}
