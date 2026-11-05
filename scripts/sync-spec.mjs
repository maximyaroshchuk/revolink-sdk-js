// Refreshes openapi.yaml from the backend: a path to apiv2.yaml (default: the monorepo copy) or the live JSON spec.
//   npm run sync-spec
//   npm run sync-spec -- https://api.revolink.link/apiv2/openapi.json
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, '..', 'openapi.yaml');
const source = process.argv[2] || path.join(here, '..', '..', '..', 'backend', 'openapi', 'apiv2.yaml');

let text;
if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Could not download ${source}: HTTP ${res.status}`);
    text = YAML.stringify(await res.json());
} else {
    text = await readFile(source, 'utf8');
}

await writeFile(target, text);
console.log(`openapi.yaml updated from ${source}`);
