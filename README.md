# Farsyn

[![CI](https://github.com/Xala-Technologies/farsyn/actions/workflows/ci.yml/badge.svg)](https://github.com/Xala-Technologies/farsyn/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40farsyn%2Fengine.svg)](https://www.npmjs.com/package/@farsyn/engine)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**Geographic experience & evidence engine.** Farsyn drives a real browser
against a live site to answer the question the rest of a search/content
stack cannot: *what does a visitor in a given market actually experience on
this page, and can we prove it?* It writes a signed evidence package —
screenshots, a trace, Core Web Vitals, an accessibility snapshot, a per-step
verdict — rather than an opinion.

Deterministic, no LLM anywhere in the measurement path, and read-only against
the world unless a journey explicitly says otherwise (`writes: true`).

## Quickstart

```bash
pnpm install
pnpm browser:install          # Chrome for Testing, ~179MB, one-time

pnpm farsyn init               # scaffolds a workspace: farsyn.config.json + inputs/ + var/
pnpm farsyn journey run --url https://example.com --geo oslo-mobile --journey reader
```

That last command opens a real Chromium behind the Oslo mobile profile, runs
the `reader` journey (land, read, scroll, maybe follow a link — nothing here
changes state), and writes an evidence package under `var/evidence/`. Swap
`--url` for your own site and `--geo` for any of the 79 bundled profiles
(`pnpm farsyn profile list`) to point it at something real.

```bash
pnpm farsyn matrix run --url https://example.com \
  --market oslo,berlin --journey reader,browse --dry-run   # plan before you spend a run
pnpm farsyn evidence inspect <runId>                        # what a run actually produced
pnpm farsyn gate check --url https://example.com --journey reader  # allow / block / unknown
```

No account or proxy vendor is required to run any of the above — geography
without a configured egress provider runs `direct`, and every claim it makes
about *where* the traffic came from is explicitly flagged unproven rather than
silently assumed. See [`docs/configuration.md`](docs/configuration.md) for
`--home`, multi-tenant overlays, and wiring a real residential proxy.

## Why it exists

A search intelligence platform can tell you a keyword is an opportunity,
write the article, and publish it. It cannot tell you that the page it just
published renders at the wrong width, shows the wrong currency, or takes five
seconds to settle for someone in Bergen. Farsyn is the layer that goes and
looks.

## The one idea worth understanding

**Geography is two axes, not one.**

| Axis | Set by | What it changes |
|---|---|---|
| **Network identity** | proxy / cloud-browser region | the IP the *server* sees → CDN edge, geo-redirects, currency, latency |
| **Browser environment** | locale, clock, coordinates, viewport | what the *page's JavaScript* believes → `navigator.language`, `Intl`, Geolocation, layout |

They are verified separately, both through the browser itself, and every axis
has three verdicts — `match`, `mismatch`, and **`unverified`**. The third is
the important one: it means the probe produced no reading, and it is neither
a pass nor a failure. A run with Oslo coordinates arriving from a Frankfurt IP
is a plausible production bug and a worthless QA profile, and only a
two-axis check tells you which you are looking at.

That rule runs through everything else. A threshold that could not be
measured is never a pass. A check whose reading never arrived is *our*
defect, not the site's. A gap in a matrix is recorded as unmeasured, never as
a market that was fine.

## What it does now

- **Two engines** behind one seam: `agent-browser` (a CLI daemon, the default)
  and Playwright (`--engine playwright`, per-context proxy, real Geolocation
  permission, restored visitor sessions). Nothing above the seam knows which
  one served a run.
- **79 profiles** — 39 markets × {mobile, desktop} — and 11 journeys, as data
  rather than code. `farsyn matrix run` expands and executes the scenarios
  under a bounded pool that records both its limit and the peak it reached.
- **Journeys behave like visitors.** They read and browse at human pace, and
  they exercise real functionality: search, registration, login, contact
  forms, CRUD. A journey that changes state declares `writes: true` and the
  run says so before starting. Pauses are drawn from a range and optional
  steps happen on a probability — all from a **seeded** generator, so a set
  of runs is representative and any single run replays exactly from its
  recorded seed.
- **Flakiness is measured, never hidden.** The journey does not retry;
  `--repeat N` runs it N times inside one browser and one network session,
  reports each step at the worst outcome any attempt saw, and tells you
  1-of-3 from 3-of-3.
- **Evidence with a shelf life.** Tiered retention by verdict, redaction at
  write time, a manifest that names what is missing — and
  `farsyn evidence prune`, which plans without deleting and only deletes
  when asked.
- **A publish gate, default-deny.** `farsyn gate check` answers allow / block
  / unknown for a page; no run, a thrown error, an errored run, or one unread
  step all block, and the exit code is 0 only for `allow`.
- **A configurable workspace.** A bundled starter catalog ships with the
  package so an install works with zero setup; `farsyn init` scaffolds a home
  directory that overlays it with your own profiles, journeys and tenants —
  no fork required to add a market.
- **An MCP server** (`@farsyn/mcp`) so an agent can read runs, evidence,
  traces and the catalog over stdio or HTTP.

## What it does not do

- **No search results or rankings.** `search/` accepts an external SERP
  observation as one confidence axis; it does not query one itself.
- **No content generation.** Nothing here writes copy, and nothing in the
  measurement path is an LLM.
- **No provisioned geographic egress out of the box.** Without a configured
  proxy provider, every run's network identity is `direct` and every
  geographic network claim is explicitly marked unproven — Farsyn refuses to
  silently pretend a market it cannot reach.
- **No scheduler.** A matrix runs when something invokes it — a human, a cron
  job, or `farsyn server`'s watch loop — not on its own.
- **No retries that hide flakiness.** See "flakiness is measured" above; this
  is deliberate, not a missing feature.

## Layout

```
packages/engine/src/
  browser/     the seam over two engines; nothing above it knows which one ran
  network/     GeoNetworkProvider (direct, http-proxy) + a cooldown store
  geo/         profiles, two-axis observation and verification
  journeys/    a deterministic step/assert DSL, its executor, and seeded variation
  evidence/    tiered retention, manifests, redaction-at-write, pruning
  findings/    severity + independent confidence + how a human re-checks it
  confidence/  five separate axes, overall capped by the weakest
  run/         the stages, one atomic run, and a bounded matrix over many
  config/      farsyn.config.json — schema, credential guard, imported defaults
  temporal/    the same stages as durable Activities
  experiments/ the harness; cli/samplers.ts holds the per-experiment logic
  fixtures/    a local server of deliberately broken pages
apps/ui/   apps/console/   packages/mcp/
inputs/    bundled starter profiles, journeys, tenants, experiments
var/       evidence, secrets  (local, gitignored)
e2e/  infra/
```

## Rules this codebase holds itself to

- **Verify by execution, not inspection.** Response shapes are captured from
  the real CLI. Temporal workflows are tested inside a real test environment
  with a real worker — retry counts are assertions about executions that
  happened.
- **Transport garbage must never be parseable as a result.** Every browser
  call returns typed data or a named failure. There is no path returning
  success with absent data.
- **A failed assertion and a broken tool are different events.** A check that
  read the page and found it wrong is a site defect; a check whose reading
  never arrived is *ours*, categorised `instrumentation`, and never filed
  against the site.
- **A setting that nothing reads is worse than a hardcoded constant**, so an
  unknown config key is rejected and an unhonoured one is not offered.
- **100% lines/statements/functions**, with entrypoints excluded and each
  exclusion carrying a comment naming why. The layer map is enforced by
  `pnpm boundaries`, not by review.

These, and 41 load-bearing invariants in total, are the working brief in
[`AGENTS.md`](AGENTS.md) — read that first if you're contributing.

## What Phase 0 established

Seven experiments, run against agent-browser 0.34.0 and Chrome 151, proving
the primitives before anything was built on top of them.

| Experiment | Verdict | What it showed |
|---|---|---|
| EXP-000 primitives | **PASS** | 10/10 browser primitives answer, proven by using each one |
| EXP-001 geo egress | **UNMEASURED** | No exit IP existed at the time, so the routing claim could not be tested at all |
| EXP-002 session stability | **PASS** | One session held one IP across 24s of reads |
| EXP-003 session isolation | **PASS** | Cookies and localStorage do not leak between sessions |
| EXP-004 profile consistency | **PASS** | A Berlin profile really does produce `de-DE`, `Europe/Berlin`, 390px |
| EXP-005 journey stability | **PASS** | 5/5 identical verdicts against a live page |
| EXP-006 evidence quality | **PASS** | 8/8 injected defects detected, 95.5% evidence completeness |

The geographic claim now has an exit IP behind it: [`docs/milestone.md`](docs/milestone.md)
records 102 live sessions through a residential proxy against a real production
site, meeting three of four acceptance thresholds. What is not built, what is
built but unproven, and what is built but quietly not working — including an
honest, dated defect log against real live findings — is tracked in
[`docs/gaps.md`](docs/gaps.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the DCO sign-off, the three gates
(`pnpm lint`, `pnpm boundaries`, `pnpm test:coverage`), and the wiring
checklists for adding a check, a journey action, a market, or an egress
provider. Security issues go through [`SECURITY.md`](SECURITY.md), not a
public issue.

## License

Apache-2.0 — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). Farsyn is
built and maintained by [Xala Technologies](https://github.com/Xala-Technologies).
