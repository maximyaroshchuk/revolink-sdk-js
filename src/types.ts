import type {components} from './generated/schema';

type Schemas = components['schemas'];

export type Link = Schemas['Link'];
export type LinkSummary = Schemas['LinkSummary'];
export type LinkCreate = Schemas['LinkCreate'];
export type LinkUpdate = Schemas['LinkUpdate'];
export type Rule = Schemas['Rule'];
export type RuleView = Schemas['RuleView'];
export type AbTest = Schemas['AbTest'];
export type Tag = Schemas['Tag'];
export type TagCreate = Schemas['TagCreate'];
export type TagUpdate = Schemas['TagUpdate'];
export type Domain = Schemas['Domain'];
export type Me = Schemas['Me'];
export type Pagination = Schemas['Pagination'];
export type BulkCreatedItem = Schemas['BulkCreatedItem'];
export type BulkFailedItem = Schemas['BulkFailedItem'];
/** Click statistics for a period: totals and breakdowns by country, device, browser, OS, referrer, rule, A/B variant. */
export type Analytics = Record<string, unknown>;

export interface Page<T> {
    data: T[];
    pagination: Pagination;
}

export interface ListLinksParams {
    page?: number;
    /** 1–200, default 50. */
    limit?: number;
    /** Substring of the name, slug or description. */
    search?: string;
    /** One short domain, or several. */
    domain?: string | string[];
    active?: boolean;
    tagIds?: string[];
    sortBy?: 'name' | 'description' | 'shortLink' | 'clicks' | 'active' | 'createdAt';
    order?: 'asc' | 'desc';
    /** Revolink query language filter. */
    rql?: string;
}

export interface AnalyticsParams {
    /** First day. A `Date` or `YYYY-MM-DD`. Earliest available day is 2025-01-01. */
    from: Date | string;
    /** Last day. Defaults to today. */
    to?: Date | string;
}

export interface BulkCreateResult {
    created: BulkCreatedItem[];
    failed: BulkFailedItem[];
}

export interface BulkUpdateResult {
    updated: Array<{id: string; name?: string; slug?: string; domain?: string}>;
    failed: BulkFailedItem[];
}

export interface BulkDeleteResult {
    deleted: Array<{id: string; slug?: string; domain?: string}>;
    failed: BulkFailedItem[];
}
