import type {HttpClient} from '../http';

/**
 * An image to upload: a `Blob`/`File` (browsers, Node 18+), or `{uri, name, type}` — the form React Native uses for a
 * file on the phone.
 */
export type UploadableFile = Blob | {uri: string; name: string; type: string};

export class Files {
    constructor(private readonly http: HttpClient) {}

    /**
     * Uploads one image (PNG, JPEG, GIF or HEIC, up to 10 MB) and returns its URL, to be used as a link's `ogImage` or
     * `qrSettings.logo`. Needs `links:write`.
     * @example
     * const {url} = await revolink.files.upload(blob, 'cover.png');
     * await revolink.links.update(id, {ogImage: url});
     */
    async upload(file: UploadableFile, name?: string): Promise<{url: string}> {
        const form = new FormData();
        // React Native's FormData accepts the `{uri, name, type}` object where the DOM typings expect a Blob.
        if (name !== undefined && file instanceof Blob) form.append('file', file, name);
        else form.append('file', file as Blob);
        return (await this.http.request<{data: {url: string}}>('POST', '/files', {form})).data;
    }
}
