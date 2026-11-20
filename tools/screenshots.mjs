// apps/<id>/screenshot.png for the catalog: each app's newest .tapp installed on the simulated TRMNL X, opened the way
// a user opens it, and its screen saved (1872x1404, what trmnl-sim's /screenshot returns).
//   node tools/screenshots.mjs [id]
// Local only, not CI: it needs TRMNL Apps Studio's web dev server running (`python3 tools/serve.py` in Studio's web/,
// SERVE, default http://localhost:8765), which starts the owner's trmnl-sim on the TRMNL_X_APPS firmware. The
// simulator and the firmware stay private; only the PNGs come here. It drives the sim with Studio's own
// SimulatorController and HttpSimBackend (STUDIO, default ~/Documents/Projects/TRMNL/trmnl-apps-studio/web), so the
// sequence is the one Studio's Run uses.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndex } from './index.mjs';
import { readTapp } from './lib/project/tapp.js';

const STUDIO = process.env.STUDIO ?? `${process.env.HOME}/Documents/Projects/TRMNL/trmnl-apps-studio/web`;
const SERVE = (process.env.SERVE ?? 'http://localhost:8765').replace(/\/$/, '');
const { HttpSimBackend } = await import(`${STUDIO}/simulator/backend.js`);
const { SimulatorController } = await import(`${STUDIO}/simulator/controller.js`);

const root = new URL('..', import.meta.url).pathname;
const only = process.argv[2];
const { index, errors } = await buildIndex(root);
for (const e of errors) console.error(`✗ ${e}`);
const apps = index.apps.filter((a) => !only || a.id === only);
if (!apps.length) { console.error(only ? `No app ${only} in apps/` : 'No apps'); process.exit(1); }

const sim = new SimulatorController(new HttpSimBackend({ control: `${SERVE}/control`, portal: `${SERVE}/portal` }));
const progress = (text) => console.log(`  ${text}`);
let inApp = false;
for (const app of apps) {
  console.log(`${app.id} ${app.version}`);
  const { manifest, wasm } = await readTapp(new Uint8Array(readFileSync(join(root, app.tapp))));
  await sim.start(progress);
  if (inApp) {   // leave the last app, as a user does: hold the middle of the touch bar
    await sim.touch('center', true);
    await sim.waitAsleep(60);
  }
  await sim.install(manifest, wasm, createHash('sha256').update(wasm).digest('hex'), progress);
  await sim.launch(manifest, 1, progress);   // a full refresh every time: no partial-refresh ghosts on the shot
  inApp = true;
  await sim.waitAsleep(60);   // the app has drawn its first screen and the device went to sleep
  const png = await sim.api.screenshot();
  writeFileSync(join(root, 'apps', app.id, 'screenshot.png'), png);
  console.log(`  apps/${app.id}/screenshot.png, ${Math.round(png.length / 1024)} KB`);
}
