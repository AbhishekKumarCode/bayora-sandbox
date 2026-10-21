#!/usr/bin/env bash
# Starts (or restarts) a Cloudflare quick tunnel to the local broker and
# prints its public URL. Quick tunnels get a NEW hostname every start; put
# the printed URL into VITE_BROKER_URL (Vercel env) or paste it into the
# dashboard's Connect dialog. For a stable hostname use a named tunnel.
set -euo pipefail
LOG=${TUNNEL_LOG:-/tmp/cloudflared.log}
pkill -f "[c]loudflared tunnel --url" 2>/dev/null || true
sleep 1
: > "$LOG"
nohup bash -c 'while true; do cloudflared tunnel --url http://localhost:4000 --no-autoupdate; echo "[tunnel] exited, restarting in 3s"; sleep 3; done' >> "$LOG" 2>&1 &
for i in $(seq 1 120); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | tail -1 || true)
  if [ -n "${URL:-}" ] && curl -s -m 5 "$URL/health" | grep -q '"ok":true'; then
    echo "$URL"; exit 0
  fi
  sleep 1
done
echo "tunnel did not come up; see $LOG" >&2; exit 1
