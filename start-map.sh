#!/usr/bin/env bash
# Start/stop the Scrap Mechanic map viewer.
#   bash start-map.sh         → start (or restart) on http://localhost:8080
#   bash start-map.sh stop    → stop
#   bash start-map.sh status  → check if running
set -euo pipefail

UNIT="sm_overview_react.service"
PORT=8080
VIEWER="/home/byte/Work/Repos/scrap-mechanic-overview/viewer"
BUN="/home/byte/.bun/bin/bun"

case "${1:-start}" in
  start)
    if systemctl --user is-active "$UNIT" &>/dev/null; then
      echo "Restarting..."
      systemctl --user restart "$UNIT"
    else
      # clean up any old failed state
      systemctl --user reset-failed "$UNIT" 2>/dev/null || true
      systemd-run --user --unit="$UNIT" \
        --working-directory="$VIEWER" \
        --setenv=PATH=/home/byte/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:/bin \
        -- "$BUN" run dev -- --port "$PORT" --host
    fi
    sleep 2
    if systemctl --user is-active "$UNIT" &>/dev/null; then
      echo "✓ Map viewer running at http://localhost:$PORT"
    else
      echo "✗ Failed to start. Check: systemctl --user status $UNIT"
      exit 1
    fi
    ;;
  stop)
    if systemctl --user is-active "$UNIT" &>/dev/null; then
      systemctl --user stop "$UNIT"
      echo "✓ Stopped"
    else
      echo "Not running"
    fi
    ;;
  status)
    if systemctl --user is-active "$UNIT" &>/dev/null; then
      echo "✓ Running at http://localhost:$PORT"
    else
      echo "Not running"
    fi
    ;;
  *)
    echo "Usage: bash start-map.sh [start|stop|status]"
    ;;
esac
