# @farsyn/mcp

MCP server for farsyn — **stdio** (local Cursor) or **Streamable HTTP** (remote URL).

## Setup (local stdio)

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
# set FARSYN_REPO_ROOT, FARSYN_SERVER_URL, FARSYN_API_TOKEN
pnpm mcp   # smoke-test (Ctrl+C)
```

## Remote URL (production)

On your VPS, `farsyn-mcp.service` listens on `127.0.0.1:4181`. Caddy (or any
reverse proxy) forwards `https://your-host.example/mcp` to that port — see
`infra/caddy-farsyn.snippet` for a worked example.

Requires the same `FARSYN_API_TOKEN` as the console API:

```bash
curl -fsS https://your-host.example/mcp/health
curl -fsS http://127.0.0.1:4181/health       # on the box
```

Cursor config (remote — no local repo needed):

```json
{
  "mcpServers": {
    "farsyn": {
      "url": "https://your-host.example/mcp",
      "headers": {
        "Authorization": "Bearer ${env:FARSYN_API_TOKEN}"
      }
    }
  }
}
```

Env vars for the HTTP server:

| Variable | Default | Purpose |
|---|---|---|
| `FARSYN_API_TOKEN` | — | **Required** for HTTP mode |
| `FARSYN_MCP_HOST` | `127.0.0.1` | Bind address |
| `FARSYN_MCP_PORT` | `4181` | Listen port |
| `FARSYN_MCP_ALLOWED_HOSTS` | from `FARSYN_SERVER_URL` | Host headers behind Caddy |
| `FARSYN_REPO_ROOT` | cwd walk | Evidence and inputs root |

Generate credentials:

```bash
pnpm farsyn server hash '<your-password>'
# exports FARSYN_ADMIN_PASSWORD_HASH, FARSYN_SESSION_SECRET, FARSYN_API_TOKEN
```

Set the same `FARSYN_API_TOKEN` on the VPS in the service's `.env`, then
`systemctl restart farsyn farsyn-mcp`.

## Local tools (evidence on disk)

| Tool | CLI equivalent |
|------|----------------|
| `profiles_list` | `farsyn profile list` |
| `journeys_list` | `farsyn journey list` |
| `tenants_list` | `farsyn tenant list` |
| `settings_get` | `GET /api/settings` |
| `runs_list` | `farsyn runs list` |
| `runs_rebuild` | `farsyn runs rebuild` |
| `dashboard_get` | `farsyn dashboard build` |
| `site_analyse` | site analysis |
| `content_analyse` | content analysis |
| `evidence_manifest` | `farsyn evidence inspect` |
| `evidence_get` | evidence package |
| `evidence_screenshot` | One screenshot as base64 PNG |
| `evidence_screenshots` | All present screenshots as base64 PNGs |
| `evidence_artifact` | Trace, HAR, snapshot, vitals, console, network, a11y, content |
| `evidence_prune` | `farsyn evidence prune` |
| `assist_explain` | `farsyn assist explain` |
| `digest_send` | `farsyn digest send` |
| `findings_file` | `farsyn findings file` |
| `findings_repair` | `farsyn findings repair` |
| `fix_run` | `farsyn fix run` |
| `keywords_research` | `farsyn keywords research` |
| `browser_verify` | `farsyn browser verify` |
| `proxy_verify` | `farsyn proxy verify` |
| `journey_run` | `farsyn journey run` |
| `gate_check` | `farsyn gate check` |
| `matrix_run` | `farsyn matrix run` |
| `experiment_run` | `farsyn experiment run` |

## Remote tools (`FARSYN_SERVER_URL` + `FARSYN_API_TOKEN`)

| Tool | HTTP |
|------|------|
| `server_health` | `GET /health` |
| `server_whoami` | `GET /api/whoami` |
| `server_settings` | `GET /api/settings` |
| `server_dashboard_rebuild` | `POST /api/dashboard/rebuild` |
| `server_watch_get` | `GET /api/watch` |
| `server_watch_update` | `PUT /api/watch` |
| `server_watch_log` | `GET /api/watch/log` |
| `server_watch_start` | `POST /api/watch/start` |
| `server_watch_target_add` | `POST /api/watch/targets` |
| `server_watch_target_remove` | `DELETE /api/watch/targets` |
| `server_live_board` | `GET /api/live` |
| `server_live_session` | `GET /api/live/:id` |
| `server_live_frame` | `GET /api/live/:id/frame` |
| `server_run_status` | `GET /api/run` |
| `server_run_start` | `POST /api/run` |
| `server_findings_repair_status` | `GET /api/findings/repair` |
| `server_findings_repair_start` | `POST /api/findings/repair` |
| `server_evidence_get` | `GET /api/evidence/:runId` |
| `server_evidence_screenshot` | `GET /api/evidence/:runId/shot/:label` |
| `server_evidence_screenshots` | `GET /api/evidence/:runId/screenshots` |
| `server_evidence_artifact` | `GET /api/evidence/:runId/artifact/:kind` |

## Resources

- `farsyn://dashboard`
- `farsyn://runs/recent`
- `farsyn://runs/{runId}`

Execution tools launch real browsers and spend proxy traffic — MCP marks them with `destructiveHint`.
