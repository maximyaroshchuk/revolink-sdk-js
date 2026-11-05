import {HttpClient, type RevolinkOptions} from './http';
import {AnalyticsResource} from './resources/analytics';
import {Domains} from './resources/domains';
import {Links} from './resources/links';
import {Tags} from './resources/tags';
import type {Me} from './types';

/**
 * @example
 * import {Revolink} from 'revolink';
 *
 * const revolink = new Revolink({apiKey: process.env.REVOLINK_API_KEY!, workspaceId: '...'});
 * const {shortLink} = await revolink.links.create({url: 'https://example.com'});
 */
export class Revolink {
    readonly links: Links;
    readonly tags: Tags;
    readonly domains: Domains;
    readonly analytics: AnalyticsResource;
    private readonly http: HttpClient;

    constructor(options: RevolinkOptions) {
        this.http = new HttpClient(options);
        this.links = new Links(this.http);
        this.tags = new Tags(this.http);
        this.domains = new Domains(this.http);
        this.analytics = new AnalyticsResource(this.http);
    }

    /** Who the key acts as, the workspace, and the key's permissions. Works with any valid key. */
    async me(): Promise<Me> {
        return (await this.http.request<{data: Me}>('GET', '/me')).data;
    }
}
