// Copied from TRMNL Apps Studio web/project/tapp.js by tools/sync-lib.sh: edit it there.
// A .tapp: a zip (stored, not compressed) with manifest.json and app.wasm, as cloud.py and the device's own
// install page read it.
import { manifestJSON, isValidID, readListing } from './project.js';
import { wasmModuleInfo, wasmProblem } from '../build/wasm-info.js';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** @param {{name: string, data: Uint8Array}[]} files @returns {Uint8Array} */
export function zipStored(files) {
  const enc = new TextEncoder();
  const local = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const n = enc.encode(name), crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 10, true);
    head.setUint32(14, crc, true); head.setUint32(18, data.length, true); head.setUint32(22, data.length, true);
    head.setUint16(26, n.length, true);
    local.push(new Uint8Array(head.buffer), n, data);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 10, true);
    dir.setUint32(16, crc, true); dir.setUint32(20, data.length, true); dir.setUint32(24, data.length, true);
    dir.setUint16(28, n.length, true); dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Where a .tapp carries the app's C source, so others can read and fork it. The device ignores the entry. */
export const SOURCE_ENTRY = 'source/app.c';
const MAX_SOURCE = 64 * 1024;

/** @param {{withSource?: boolean}} [options] the source goes in unless the author turned it off (project.withSource) */
export const tapp = (project, wasm, { withSource = project.withSource !== false } = {}) => zipStored([
  { name: 'manifest.json', data: new TextEncoder().encode(manifestJSON(project)) },
  { name: 'app.wasm', data: wasm },
  ...(withSource && project.source ? [{ name: SOURCE_ENTRY, data: new TextEncoder().encode(project.source) }] : []),
]);

export class TappError extends Error {}

const MAX_TAPP = 512 * 1024;   // as dev_bridge.py: a module is at most 256 KB, so anything larger is refused unread
const MAX_WASM = 256 * 1024;   // the device's limit (apps_upload.cpp)

/**
 * A .tapp from anywhere (a file, a link): its manifest and app.wasm, checked the way the device and cloud.py check
 * them. Throws TappError with a message for the user.
 * @param {Uint8Array} bytes
 * @returns {Promise<{manifest: {id: string, name: string, version: string, forkedFrom?: object}, listing: object,
 *   wasm: Uint8Array, source: string | null}>} source is null when the author left it out: such an app cannot be forked
 */
export async function readTapp(bytes) {
  if (bytes.length > MAX_TAPP) throw new TappError(`The file is ${Math.ceil(bytes.length / 1024)} KB; a .tapp is at most ${MAX_TAPP / 1024} KB.`);
  const files = await unzip(bytes);
  const manifestBytes = files.get('manifest.json'), wasm = files.get('app.wasm');
  if (!manifestBytes || !wasm) throw new TappError('Not a .tapp: it needs manifest.json and app.wasm.');
  let m;
  try { m = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)); }
  catch { throw new TappError('manifest.json is not valid JSON.'); }
  if (m?.app_api !== 'v1') throw new TappError(`The app needs App API ${m?.app_api ?? '(none)'}; this TRMNL has v1.`);
  if (!isValidID(m.id)) throw new TappError('The app id must be 1 to 15 lowercase letters, digits or dashes.');
  if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 40) throw new TappError('The app needs a name of up to 40 characters.');
  if (typeof m.version !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(m.version)) throw new TappError('The version must look like 1.2.3.');
  if (wasm.length > MAX_WASM) throw new TappError(`app.wasm is ${Math.ceil(wasm.length / 1024)} KB; TRMNL takes up to 256 KB.`);
  let info;
  try { info = wasmModuleInfo(wasm); } catch (e) { throw new TappError(`app.wasm: ${e.message}.`); }
  const problem = wasmProblem(info);
  if (problem) throw new TappError(`app.wasm: ${problem}.`);
  const sourceBytes = files.get(SOURCE_ENTRY);
  let source = null;
  if (sourceBytes) {
    if (sourceBytes.length > MAX_SOURCE) throw new TappError(`The app's source is over ${MAX_SOURCE / 1024} KB.`);
    try { source = new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes); }
    catch { throw new TappError("The app's source is not UTF-8 text."); }
  }
  const forkedFrom = m.forked_from && typeof m.forked_from.id === 'string' && typeof m.forked_from.version === 'string'
    ? { id: m.forked_from.id, version: m.forked_from.version,
        ...(typeof m.forked_from.source === 'string' && /^https:\/\//.test(m.forked_from.source) && { source: m.forked_from.source }) }
    : undefined;
  return { manifest: { id: m.id, name: m.name.trim(), version: m.version, ...(forkedFrom && { forkedFrom }) },
    listing: readListing(m), wasm, source };
}

/** Name -> bytes from a zip's central directory: stored entries, and deflated ones (other zip tools). */
async function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new TappError('Not a .tapp: the file is not a zip.');
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const files = new Map(), dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || v.getUint32(at, true) !== 0x02014b50) throw new TappError('The .tapp is damaged.');
    const method = v.getUint16(at + 10, true), crc = v.getUint32(at + 16, true);
    const packed = v.getUint32(at + 20, true), size = v.getUint32(at + 24, true);
    const nameLen = v.getUint16(at + 28, true), extra = v.getUint16(at + 30, true), comment = v.getUint16(at + 32, true);
    const local = v.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extra + comment;
    if (size > MAX_TAPP) throw new TappError('The .tapp is damaged.');
    if (local + 30 > bytes.length || v.getUint32(local, true) !== 0x04034b50) throw new TappError('The .tapp is damaged.');
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    if (start + packed > bytes.length) throw new TappError('The .tapp is damaged.');
    const raw = bytes.subarray(start, start + packed);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new TappError(`The .tapp uses a zip compression TRMNL does not read (method ${method}).`);
    if (data.length !== size || crc32(data) !== crc) throw new TappError(`The .tapp is damaged (${name} does not match its checksum).`);
    files.set(name, data);
  }
  return files;
}
