import {HttpClient, type RevolinkOptions} from './http';
import {AnalyticsResource} from './resources/analytics';
import {Domains} from './resources/domains';
import {Files} from './resources/files';
import {Templates} from './resources/templates';
import {Links} from './resources/links';
import {Tags} from './resources/tags';
import type {Me, Workspace} from './types';

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
    readonly files: Files;
    readonly templates: Templates;
    private readonly http: HttpClient;

    constructor(options: RevolinkOptions) {
        this.http = new HttpClient(options);
        this.links = new Links(this.http);
        this.tags = new Tags(this.http);
        this.domains = new Domains(this.http);
        this.analytics = new AnalyticsResource(this.http);
        this.files = new Files(this.http);
        this.templates = new Templates(this.http);
    }

    /**
     * The workspaces the key's user owns or belongs to. Needs only a valid key, so it works before a workspace is
     * chosen — hence static: `await Revolink.listWorkspaces({apiKey})`.
     */
    static async listWorkspaces(options: Omit<RevolinkOptions, 'workspaceId'>): Promise<Workspace[]> {
        const http = new HttpClient(options, false);
        return (await http.request<{data: Workspace[]}>('GET', '/workspaces')).data;
    }

    /** Who the key acts as, the workspace, and the key's permissions. Works with any valid key. */
    async me(): Promise<Me> {
        return (await this.http.request<{data: Me}>('GET', '/me')).data;
    }
}
