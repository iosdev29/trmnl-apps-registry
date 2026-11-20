// Builds index.json, the one file a catalog page reads, from apps/<id>/<id>-<version>.tapp, refusing any app the
// device or TRMNL Apps Studio would refuse, and any that misses what a listing needs.
//   node tools/index.mjs           write index.json
//   node tools/index.mjs --check   fail when an app is invalid or index.json is not up to date (CI)
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readTapp } from './lib/project/tapp.js';

const REQUIRED = ['summary', 'author', 'license'];

const semver = (v) => v.split('.').map(Number);
const newer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

/** @returns {Promise<{index: object, errors: string[]}>} */
export async function buildIndex(root) {
  const errors = [], apps = [];
  const appsDir = join(root, 'apps');
  for (const dir of existsSync(appsDir) ? readdirSync(appsDir).sort() : []) {
    const files = readdirSync(join(appsDir, dir));
    const tapps = files.filter((f) => f.endsWith('.tapp'));
    if (!tapps.length) { errors.push(`apps/${dir}: no .tapp`); continue; }
    const versions = [];
    for (const file of tapps) {
      const where = `apps/${dir}/${file}`;
      const bytes = new Uint8Array(readFileSync(join(appsDir, dir, file)));
      let app;
      try { app = await readTapp(bytes); } catch (e) { errors.push(`${where}: ${e.message}`); continue; }
      const { id, name, version, forkedFrom } = app.manifest;
      if (id !== dir) { errors.push(`${where}: the manifest's id is "${id}", the folder is "${dir}"`); continue; }
      if (file !== `${id}-${version}.tapp`) { errors.push(`${where}: name it ${id}-${version}.tapp`); continue; }
      const missing = REQUIRED.filter((k) => !app.listing[k]);
      if (missing.length) { errors.push(`${where}: manifest.json needs ${missing.join(', ')} for the catalog`); continue; }
      versions.push({
        id, name, version, ...app.listing, forked_from: forkedFrom ?? null,
        tapp: `apps/${dir}/${file}`, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length,
        has_source: app.source !== null,
      });
    }
    if (!versions.length) continue;
    const latest = versions.reduce((a, b) => (newer(b.version, a.version) ? b : a));
    const shot = files.includes('screenshot.png') ? `apps/${dir}/screenshot.png` : null;
    apps.push({ ...latest, screenshot: shot, versions: versions.map((v) => v.version).sort((a, b) => (newer(a, b) ? -1 : 1)) });
  }
  return { index: { schema: 1, apps }, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('..', import.meta.url).pathname;
  const { index, errors } = await buildIndex(root);
  for (const e of errors) console.error(`✗ ${e}`);
  const json = JSON.stringify(index, null, 2) + '\n';
  const path = join(root, 'index.json');
  if (process.argv.includes('--check')) {
    const stale = !existsSync(path) || readFileSync(path, 'utf8') !== json;
    if (stale) console.error('✗ index.json is not up to date: run npm run build and commit it');
    if (errors.length || stale) process.exit(1);
    console.log(`✓ ${index.apps.length} apps`);
  } else {
    writeFileSync(path, json);
    console.log(`index.json: ${index.apps.length} apps${errors.length ? `, ${errors.length} refused` : ''}`);
    if (errors.length) process.exit(1);
  }
}
