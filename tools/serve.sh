#!/usr/bin/env bash
# Serve the sm_overview viewer locally.
# Run this, then open http://localhost:8080 in your browser. Ctrl+C to stop.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIEWER_DIR="$SCRIPT_DIR/../viewer"
PORT="${PORT:-8080}"

if [ ! -f "$VIEWER_DIR/index.html" ]; then
    echo "viewer/index.html not found at $VIEWER_DIR" >&2
    exit 1
fi

echo "Serving sm_overview at http://localhost:$PORT  (Ctrl+C to stop)"
echo "Viewer dir: $VIEWER_DIR"
cd "$VIEWER_DIR"
exec python3 -m http.server "$PORT"
