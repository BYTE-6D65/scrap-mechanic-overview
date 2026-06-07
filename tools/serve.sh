#!/usr/bin/env bash
# Launch the sm_overview viewer.
#   • installs JS deps if needed
#   • regenerates the tile pyramid if cells.json is newer than the last build
#     (or if no pyramid exists yet)
#   • starts the Vite dev server
# Then open http://localhost:8080 in your browser. Ctrl+C to stop.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
VIEWER="$REPO/viewer"
DATA="$VIEWER/public/data/cells.json"
MANIFEST="$VIEWER/public/tiles/manifest.json"

cd "$REPO"
if [ ! -d node_modules ]; then
  echo "Installing root deps (sharp)…"
  bun install
fi
cd "$VIEWER"
if [ ! -d node_modules ]; then
  echo "Installing viewer deps…"
  bun install
fi

if [ ! -f "$DATA" ]; then
  echo "NOTE: no cells.json found at $DATA"
  echo "      run: python3 \"$SCRIPT_DIR/extract_cells.py\"  (after exporting from the game)"
fi

# Rebuild the pyramid when the data changed or the pyramid is missing.
if [ ! -f "$MANIFEST" ] || [ "$DATA" -nt "$MANIFEST" ]; then
  echo "Building tile pyramid (this runs once per world / after new data)…"
  bun "$REPO/tools/build-tiles.mjs" "$DATA"
else
  echo "Tile pyramid up to date (cells.json older than manifest.json)."
fi

echo
echo "➜  Viewer: http://localhost:8080   (Ctrl+C to stop)"
exec bun run dev
