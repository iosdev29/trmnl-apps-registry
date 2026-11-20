#!/bin/sh
# Copies TRMNL Apps Studio's .tapp reader and its checks, so the registry refuses exactly what Studio and the device
# refuse. shortcut: a copy, not a dependency; upgrade to a shared npm package once Studio is published.
set -e
STUDIO="${STUDIO:-$HOME/Documents/Projects/TRMNL/trmnl-apps-studio/web}"
here="$(dirname "$0")/lib"
mkdir -p "$here/project" "$here/build"
for f in project/tapp.js project/project.js build/wasm-info.js; do
  { echo "// Copied from TRMNL Apps Studio web/$f by tools/sync-lib.sh: edit it there."; cat "$STUDIO/$f"; } > "$here/$f"
done
echo "synced from $STUDIO"
