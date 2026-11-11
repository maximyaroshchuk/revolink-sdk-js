import type {HttpClient} from '../http';
import type {Template} from '../types';

export class Templates {
    constructor(private readonly http: HttpClient) {}

    /**
     * The workspace's saved UTM templates. A template's `content` holds values for `source`, `medium`, `campaign`,
     * `term`, `content`, `referral` and custom names; applying it to a rule means removing the destination's `utm_*`
     * parameters and adding every non-empty value as `utm_<name>=<value>` (inside the `#fragment` when the URL has
     * one). Needs `links:read`.
     */
    async list(type: 'utm' = 'utm'): Promise<Template[]> {
        return (await this.http.request<{data: Template[]}>('GET', '/templates', {query: {type}})).data;
    }
}
