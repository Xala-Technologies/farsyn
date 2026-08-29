# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(with the usual pre-1.0 caveat: a `0.x` release may contain breaking changes
without a major bump).

This file deliberately doesn't try to be a day-by-day, why-it-changed record —
that lives in the project's internal history, not in this repository.

## [Unreleased]

## [0.1.0] — 2026-08-29

Initial public release, as **Farsyn** (previously developed and operated
under the internal name `geoqa`).

### Added

- The core loop: `farsyn run` / `farsyn journey run` / `farsyn matrix run`
  drive a real browser against a live site and produce a signed evidence
  package — screenshots, a trace, Core Web Vitals, an accessibility snapshot,
  and a per-step verdict.
- **Geography verified on two independent axes** — network identity (the IP
  the server sees) and browser environment (what the page's JavaScript
  believes) — each with a three-valued verdict (`match` / `mismatch` /
  `unverified`), never collapsed into a single geo score.
- Two browser engines behind one seam: `agent-browser` (default) and
  Playwright (`--engine playwright`), plus the e2e suite that proves the
  seam against a real Chromium.
- A journeys DSL — read-only browsing plus real functional flows (search,
  registration, login, contact forms, CRUD), seeded for replayable human-like
  variation, with `writes: true` journeys declared and flagged in their own
  evidence.
- A confidence model with five independent axes, capped by the weakest one
  rather than averaged.
- A bounded matrix runner across markets × devices × journeys, in-process or
  durable via Temporal, rendering the same result shape either way.
- A publish gate (`farsyn gate check`) that is default-deny: no run, an
  error, or an unread step all block.
- Per-tenant ownership, traffic/run quota, and evidence isolation
  (`--tenant`), with path containment enforced on every resolved path.
- An MCP server (`@farsyn/mcp`) so an agent can read runs, evidence, traces,
  and the catalog over stdio or HTTP.
- `farsyn init` and a configurable workspace: a bundled starter catalog of
  profiles and journeys ships with the package, with a user's own home
  directory overlaying it — no fork required to add a market or a journey.
- Evidence retention and pruning with tiered lifetimes, redaction enforced
  at write time, and a HAR that is deleted (not merely unlisted) when a
  passing tier doesn't retain it.
- Apache-2.0 licensing, contribution guidelines, and a public CI pipeline
  (typecheck, boundaries, 100%-gate coverage, CodeQL).

[Unreleased]: https://github.com/Xala-Technologies/farsyn/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Xala-Technologies/farsyn/releases/tag/v0.1.0
