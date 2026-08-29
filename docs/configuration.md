# Configuration

Where a workspace lives, what ships inside the npm package versus what a user
supplies, and the order in which `farsyn` decides between them. The
mechanics live in [`packages/engine/src/repo.ts`](../packages/engine/src/repo.ts)
(`resolveWorkspace`) and
[`packages/engine/src/cli/commands.ts`](../packages/engine/src/cli/commands.ts)
(`resolveEngineWorkspace`, `farsynInit`); this page is the map, not a second
copy of either.

---

## 1. Two roots, not one

| Root | What lives there | Writable? |
|---|---|---|
| **bundled** | the 79 starter profiles and 11 journeys that ship *inside* the `@farsyn/engine` npm package | no — read-only, part of the install |
| **home** (a.k.a. the *workspace*) | tenants, a profiles/journeys **overlay**, `var/evidence`, `var/secrets`, and `farsyn.config.json` itself | yes |

A fresh `npm install -g @farsyn/engine` already has a full market catalog —
`farsyn profile list` and `farsyn journey run` work with **no setup at all**,
because the bundled root travels with the package. `farsyn init` (§4) exists
for the data a workspace eventually needs on top of that: a config file,
custom profiles, tenants — not to make the bundled catalog work, which it
already does.

A profile or journey resolves **home-first**: `<home>/inputs/profiles/
oslo-mobile.json` REPLACES the bundled file of the same name, exactly the way
a tenant's own file already replaces the shared set (`resolveDataPath` in
`cli/commands.ts`). Dropping in a file with a bundled id customises it;
dropping in a new id adds a market or journey nobody shipped.

## 2. Finding `home`

Precedence, highest first:

1. **`--home <dir>`** — wins over everything, every time.
2. **`FARSYN_HOME`** environment variable.
3. **`paths.home`** in `farsyn.config.json` — see §3 for why this is a
   second pass rather than a single lookup.
4. **The farsyn git checkout itself**, if this process happens to be running
   from inside one (`pnpm-workspace.yaml` plus
   `packages/engine/inputs/{profiles,journeys}` found by walking upward from
   the entrypoint). This is what makes a contributor's `pnpm farsyn …` inside
   the monorepo use the checkout with no flag needed, and it is the *only*
   case where `home` is not really a separate directory.
5. **`~/.farsyn`** — the default for everyone else: `HOME` (or
   `os.homedir()`) plus `.farsyn`.

Every run prints which one it used, on stderr, so `--json` on stdout stays
machine-readable:

```
config: built-in defaults (no farsyn.config.json at /Users/you/.farsyn/farsyn.config.json)
home: /Users/you/.farsyn
```

## 3. Why `paths.home` needs two passes

`farsyn.config.json` can itself redirect the workspace (`paths.home`), which
creates an ordering question: you need to know where `home` is to find the
config file, but the config file might say `home` is somewhere else.

`resolveEngineWorkspace` resolves it in two passes:

1. Find `home` using steps 1, 2, 4 and 5 above (skipping `paths.home`,
   which nothing has read yet) and load whatever config file sits there.
2. If that file declares `paths.home`, resolve it **relative to the config
   file's own directory** and redirect — but `--home`/`FARSYN_HOME` still
   outrank it, so an explicit override is never fought by a file it was
   meant to bypass.

This is one function, called by both the CLI (`cli/index.ts`) and the MCP
server (`packages/mcp/src/deps.ts`), so the two can never disagree about
where "home" is for the same invocation.

## 4. `farsyn init`

```
farsyn init [--home <dir>] [--force] [--json]
```

Scaffolds the workspace found by the precedence above:

- the home directory itself
- `inputs/profiles/`, `inputs/journeys/`, `inputs/tenants/` — the overlay
- `var/evidence/`, `var/secrets/`
- a starter `farsyn.config.json`, commented, with every value shown equal to
  the built-in default — filling it in changes nothing until you edit it

It is **idempotent and additive**: an existing directory is reported, never
recreated; an existing `farsyn.config.json` is left alone unless `--force`
names it explicitly. Running it twice against the same `--home` is safe and
does nothing the second time.

Nothing above is a prerequisite for a run — the bundled catalog already
answers `farsyn profile list`, `farsyn journey list` and `farsyn run` with no
workspace at all. `init` exists so there is somewhere to put your own data
once you have some.

## 5. `farsyn.config.json`

Optional. Absent is not an error — the run says so and uses the built-in
defaults. Present and malformed **is** an error and stops the run: falling
back to defaults for a file you edited on purpose is the exact failure this
surface exists to close (see `docs/gaps.md` B-1).

Precedence everywhere it applies: **flag > config file > built-in default.**
Every key documented in
[`farsyn.config.example.json`](../farsyn.config.example.json) is honoured at
a real call site; an unknown key is rejected rather than silently ignored,
so a typo cannot look like a setting that took.

Credentials never live here. Proxy credentials come from
`FARSYN_PROXY_<MARKET>` environment variables only, and any credential-shaped
key in the file — `proxyPassword`, `apiKey`, `token`, and so on — is refused
by name with a message saying where it belongs.

Keys, briefly (the example file carries the full rationale for each):

| Key | Default | What it does |
|---|---|---|
| `network.provider` | `"direct"` | `direct` \| `http-proxy` |
| `network.verifyEndpoint` | `https://ipinfo.io/json` | where the browser reads its own egress identity from |
| `network.cooldownMs` | 1 hour | how long a provider is skipped after a run proves its egress wrong |
| `network.directFallback` | `false` | fall back to direct egress rather than refuse, when the proxy is unusable |
| `browser.commandTimeoutMs` / `idleTimeoutMs` | engine's own default | wall-clock caps on one agent-browser command |
| `evidence.root` | `var/evidence` | resolved relative to `home`, exactly like `--evidence-root` |
| `evidence.retention` | see `evidence/manifest.ts` | which artifacts survive per verdict tier |
| `paths.home` | unset | redirect the workspace without moving this file — see §3 |

## 6. Multi-tenancy is layered on top

`--tenant <id>` scopes a whole invocation to `<home>/inputs/tenants/<id>.yaml`.
A tenant's own profiles and journeys take precedence over the home overlay,
which takes precedence over the bundled catalog — three layers, checked in
that order, never merged. Evidence, the run history and the proxy cooldown
store all move under the tenant's own directory, so two tenants sharing one
`home` cannot read or freeze each other's data.

## 7. De-vendoring

Every optional integration sits behind an injectable interface so a user
without that account is never blocked, and is told plainly rather than
receiving a fabricated result:

- **Proxy usage** — `tenant/usage-probe.ts`'s `UsageProbe`, with `decodo` as
  one implementation. An unreadable figure is `unmeasured` and the run
  proceeds with a warning that the traffic budget is not being enforced;
  it never reads as zero spent.
- **Search observation** — `search/serpapi.ts` behind `SearchProvider`.
  Absent credentials are `unconfigured`, a rejected key is `unusable`, and
  neither is silently treated as "the tenant ranks nowhere".
- **Login OTP / digest mail** — `mail/agentmail.ts`'s `ReceiveOtp` and
  `mail/send.ts`'s `sendAgentMail`, both injected with a real default and
  overridable the same way every other provider is.

None of these need to be configured for the core loop — `farsyn run`,
`farsyn journey run`, `farsyn matrix run` — to work.
