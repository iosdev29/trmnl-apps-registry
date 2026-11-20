// Copied from TRMNL Apps Studio web/build/wasm-info.js by tools/sync-lib.sh: edit it there.
// What a WebAssembly module imports and exports, read from its import (2) and export (7) sections.
// The same check as cloud.py install and WasmModuleInfo.swift: only App API v1 imports, and a trmnl_event export.

export class WasmParseError extends Error {}

/** App API v1 as the device registers it (apps_host.cpp) and cloud.py allows it. */
export const ALLOWED_IMPORTS = new Set([
  'env.memory', 'env.abort', 'trmnl_ui_v1.render', 'trmnl_kv_v1.get', 'trmnl_kv_v1.set', 'trmnl_kv_v1.remove',
  ...['device_model', 'screen_width', 'screen_height', 'screen_depth', 'inputs', 'battery', 'now', 'log',
    'session_exit', 'buzzer', 'app_version'].map((f) => 'trmnl_sys_v1.' + f),
  ...['count', 'name', 'size', 'read', 'remove', 'request_upload', 'paginate', 'page_start', 'page_of',
    'take_message'].map((f) => 'trmnl_files_v1.' + f),
]);

/** @param {Uint8Array} bytes @returns {{imports: string[], exports: string[]}} */
export function wasmModuleInfo(bytes) {
  const r = reader(bytes);
  const magic = [0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0];
  if (!magic.every((b) => r.byte() === b)) throw new WasmParseError('not a WebAssembly module');
  const imports = [], exports = [];
  while (!r.atEnd()) {
    const id = r.byte();
    const s = reader(r.bytes(r.leb()));
    if (id === 2) {
      for (let n = s.leb(); n > 0; n--) {
        imports.push(s.name() + '.' + s.name());
        switch (s.byte()) {                       // the import's kind and its description
          case 0: s.leb(); break;                 // function: type index
          case 1: s.byte(); s.limits(); break;    // table
          case 2: s.limits(); break;              // memory
          case 3: s.bytes(2); break;              // global: type, mutability
          default: s.leb();                       // tag
        }
      }
    } else if (id === 7) {
      for (let n = s.leb(); n > 0; n--) {
        exports.push(s.name());
        s.byte();
        s.leb();
      }
    }
  }
  return { imports, exports };
}

/** Why the device would refuse this module, or null when it passes. */
export function wasmProblem({ imports, exports }) {
  const bad = imports.filter((i) => !ALLOWED_IMPORTS.has(i)).sort();
  if (bad.length) return 'Imports outside App API v1: ' + bad.join(', ');
  if (!exports.includes('trmnl_event')) return 'No trmnl_event export';
  return null;
}

function reader(bytes) {
  let at = 0;
  const r = {
    atEnd: () => at >= bytes.length,
    byte() {
      if (at >= bytes.length) throw new WasmParseError('truncated');
      return bytes[at++];
    },
    bytes(n) {
      if (n < 0 || at + n > bytes.length) throw new WasmParseError('truncated');
      at += n;
      return bytes.subarray(at - n, at);
    },
    leb() {
      let result = 0, shift = 0;
      for (;;) {
        const b = r.byte();
        if (shift < 32) result = (result | ((b & 0x7f) << shift)) >>> 0;
        if ((b & 0x80) === 0) return result;
        shift += 7;
      }
    },
    name: () => new TextDecoder().decode(r.bytes(r.leb())),
    limits() {
      const flags = r.byte();
      r.leb();
      if (flags & 1) r.leb();
    },
  };
  return r;
}
