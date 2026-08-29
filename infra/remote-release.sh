#!/usr/bin/env bash
# Runs ON the VPS after rsync. Installs deps, rebuilds the UI, restarts systemd,
# and waits for /health. Does not touch .env, farsyn.config.json, var/, or any
# watch.yaml — those stay on the machine.
set -euo pipefail

ROOT=/opt/farsyn
export PATH=/usr/local/bin:/usr/bin:/bin

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "refusing: $ROOT/.env is missing — credentials are not in git" >&2
  exit 1
fi
if grep -q '^SSH_' .env; then
  echo "refusing: SSH_ keys must not live on the server .env" >&2
  exit 1
fi
if [[ ! -f farsyn.config.json ]]; then
  echo "refusing: $ROOT/farsyn.config.json is missing — copy the example and set network.provider" >&2
  exit 1
fi

pnpm install --frozen-lockfile
pnpm ui:build
test -f "$ROOT/apps/ui/dist/index.html"

install -m 644 "$ROOT/infra/farsyn.service" /etc/systemd/system/farsyn.service
install -m 644 "$ROOT/infra/farsyn-bridge.service" /etc/systemd/system/farsyn-bridge.service
install -m 644 "$ROOT/infra/farsyn-mcp.service" /etc/systemd/system/farsyn-mcp.service
install -m 644 "$ROOT/infra/farsyn-mcp-bridge.service" /etc/systemd/system/farsyn-mcp-bridge.service
install -m 644 "$ROOT/infra/farsyn-digest.service" /etc/systemd/system/farsyn-digest.service
install -m 644 "$ROOT/infra/farsyn-digest.timer" /etc/systemd/system/farsyn-digest.timer
install -m 644 "$ROOT/infra/farsyn-fix.service" /etc/systemd/system/farsyn-fix.service
install -m 644 "$ROOT/infra/farsyn-fix.timer" /etc/systemd/system/farsyn-fix.timer
systemctl daemon-reload
systemctl enable --now farsyn-bridge.service
systemctl enable --now farsyn-mcp-bridge.service
systemctl enable --now farsyn-mcp.service
systemctl enable --now farsyn-digest.timer
systemctl enable --now farsyn-fix.timer
systemctl restart farsyn.service
systemctl restart farsyn-mcp.service

for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:4180/health | grep -q '"ok"'; then
    if curl -fsS --max-time 2 http://127.0.0.1:4181/health | grep -q '"farsyn-mcp"'; then
      echo "farsyn /health ok; farsyn-mcp /health ok"
      exit 0
    fi
  fi
  sleep 1
done

echo "farsyn did not become healthy on 127.0.0.1:4180 or MCP on 4181" >&2
systemctl --no-pager --full status farsyn.service farsyn-mcp.service || true
exit 1
