# TRMNL Apps registry (prototype)

A community catalog of TRMNL apps (`.tapp`), in the spirit of [usetrmnl/tailor-designs](https://github.com/usetrmnl/tailor-designs): apps arrive by pull request, CI checks them, and `index.json` is the one file a catalog page reads. Nothing runs on TRMNL's servers: the catalog is static, and apps install from the browser straight onto the device over the local network.

## Add or update an app

No build step: a pull request only adds the `.tapp` (and, if you like, a screenshot).

- **From TRMNL Apps Studio:** open the catalog, press **Submit**, fill the listing (summary, author, license; the source goes in by default so others can fork it) and press **Download and open GitHub**. Drag the downloaded `<id>-<version>.tapp` onto the GitHub page that opens; GitHub forks the registry for you and opens a pull request.
- **By hand:** put the file at `apps/<id>/<id>-<version>.tapp` (GitHub's **Add file > Upload files** works) and open a pull request. A new version is a new file next to the old ones; the newest is listed.

A `screenshot.png` in the app's folder (the 1872x1404 screen) is shown on its tile.

CI refuses an app unless:
- it is a valid `.tapp`: a zip with `manifest.json` and `app.wasm`, App API v1, `app.wasm` at most 256 KB importing only App API v1 and exporting `trmnl_event` (the device's own checks);
- the folder and file name match the manifest's id and version;
- `manifest.json` has `summary`, `author` and `license`.

After a merge, the Pages workflow builds `index.json` from `apps/` and publishes the catalog.

## manifest.json

The device reads `app_api`, `id`, `name` and `version`; the catalog reads the rest. One file, so the listing can't drift from the app.

```json
{
  "app_api": "v1", "author": "github:you", "devices": ["x"],
  "forked_from": { "id": "tally", "version": "1.1.0" },
  "id": "tally-fork", "license": "MIT", "name": "Tally by Five",
  "source": "https://github.com/you/tally-by-five", "summary": "Tally, but Next adds five.", "version": "1.0.0"
}
```

`forked_from` is set by Studio's **Fork**; a fork always has its own id.

## Layout

| Path | What |
|---|---|
| `apps/<id>/` | the app's `.tapp` versions and an optional `screenshot.png` |
| `index.json` | not in git: built by the Pages workflow; `npm run build` makes one for a local preview (`python3 -m http.server`) |
| `index.html` | the gallery (GitHub Pages) |
| `tools/index.mjs` | builds and checks `index.json` |
| `tools/lib/` | Studio's `.tapp` reader, copied by `tools/sync-lib.sh` |
| `tools/screenshots.mjs` | the maintainers' screenshots, see below |

## Screenshots

`node tools/screenshots.mjs [id]` installs each app's newest `.tapp` on the simulated TRMNL X, opens it from the menu
and saves `apps/<id>/screenshot.png`. It runs only on a maintainer's Mac, not in CI: it needs TRMNL Apps Studio's web
dev server (`python3 tools/serve.py` in Studio's `web/`), which runs trmnl-sim on the TRMNL X apps firmware. The
simulator and the firmware are private and never come into this repository; only the PNGs do. It reuses Studio's
`simulator/controller.js` (set `STUDIO` to Studio's `web/` folder and `SERVE` to the dev server if they are elsewhere).
