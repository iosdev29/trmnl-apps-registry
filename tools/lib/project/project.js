// Copied from TRMNL Apps Studio web/project/project.js by tools/sync-lib.sh: edit it there.
// One app being written: its manifest fields and its C source (Project/AppProject.swift), and how Claude's code
// becomes the next app (StudioModel.next).

/**
 * @typedef {{id: string, version: string, source?: string}} ForkOrigin the app a fork was made from
 * @typedef {{summary?: string, author?: string, license?: string, source?: string, devices?: string[]}} Listing
 *   what a catalog shows: written into manifest.json, which the device reads only app_api, id, name and version of
 * @typedef {{id: string, name: string, version: string, source: string, forkedFrom?: ForkOrigin, listing?: Listing}} AppProject
 */

/** The device's rule for app ids (apps_valid_id): [a-z0-9-], 1 to 15 characters. */
export const isValidID = (id) => /^[a-z0-9-]{1,15}$/.test(id);

/** The next patch version ("1.0.3" -> "1.0.4"), so every build the chat produces is a new version on the device. */
export function nextVersion(version) {
  const parts = version.split('.').filter((p) => /^[+-]?\d+$/.test(p)).map(Number);
  if (parts.length !== 3) return '1.0.0';
  parts[2] += 1;
  return parts.join('.');
}

/** manifest.json as the Mac app writes it (sorted keys); a fork names its origin, a listed app its catalog fields. */
export function manifestJSON(p) {
  const l = p.listing ?? {};
  const m = {
    app_api: 'v1', author: l.author, devices: l.devices, forked_from: p.forkedFrom, id: p.id, license: l.license,
    name: p.name, source: l.source, summary: l.summary, version: p.version,
  };
  return JSON.stringify(Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)));
}

/** An id no saved app uses yet: the wanted one, else with -2, -3... (still 15 characters at most). */
export function freeID(wanted, taken) {
  if (!taken.has(wanted)) return wanted;
  for (let n = 2; n <= 99; n++) {
    const suffix = `-${n}`;
    const id = wanted.slice(0, 15 - suffix.length) + suffix;
    if (!taken.has(id)) return id;
  }
  return crypto.randomUUID().slice(0, 15);
}

/**
 * The app after Claude's code: an update keeps the id and takes the next version; a new app gets a free id and
 * starts at 1.0.0, so the previous app stays saved.
 * @param {AppProject} current @param {string} source
 * @param {{action: string, id: string, name: string} | null} manifest @param {Set<string>} taken saved app ids
 */
export function nextProject(current, source, manifest, taken) {
  if (!manifest) return { ...current, version: nextVersion(current.version), source };
  if (manifest.action === 'update' || manifest.id === current.id) {
    return { ...current, name: manifest.name, version: nextVersion(current.version), source };
  }
  return { id: freeID(manifest.id, taken), name: manifest.name, version: '1.0.0', source };
}

/**
 * A fork of an opened .tapp: a new project from its source, with an id unlike the original's (the same id would
 * replace the original on the device), starting at 1.0.0 and naming where it came from.
 * @param {{manifest: {id: string, name: string, version: string}, source: string, sourceURL?: string}} app
 * @param {Set<string>} taken saved app ids
 * @returns {AppProject}
 */
export function forkProject(app, taken) {
  const { id, name, version } = app.manifest;
  const base = id.slice(0, 10) + '-fork';
  return {
    id: freeID(base, new Set([...taken, id])),
    name: `${name} (fork)`.slice(0, 40),
    version: '1.0.0',
    source: app.source,
    forkedFrom: { id, version, ...(app.sourceURL && { source: app.sourceURL }) },
  };
}
