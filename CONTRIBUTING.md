# Contributing to Farsyn

Thanks for considering it. This file is short on purpose — the real brief is
[`AGENTS.md`](AGENTS.md), and it stays a single vendor-neutral copy rather than
being restated here and drifting. Read it before your first PR; a lot of the
codebase's non-obvious rules exist because they were already broken once, and
the comment naming the incident is usually right above the code it guards.

## Before you start

- **Read `AGENTS.md` end to end once.** It has the commands, the layer map,
  the 41 load-bearing invariants, the testing conventions, and a wiring
  checklist for each kind of change (a new journey check, a new CLI command, a
  new market, a new browser engine, …). Find the checklist that matches what
  you're doing before you start.
- **This repo's comments carry the reasoning.** If you're about to delete or
  simplify something that looks redundant, read the comment above it first —
  a fair amount of what looks like noise is load-bearing.
- Skim [`docs/architecture.md`](docs/architecture.md) for *why* a seam is
  where it is, and [`docs/gaps.md`](docs/gaps.md) for what's already known to
  be missing or broken — check there before assuming something works, and
  before filing an issue that duplicates a known gap.

## The three gates

Every PR is checked against the same three commands CI runs. Run them
locally before you open one:

```bash
pnpm lint          # tsc --noEmit — no ESLint, no formatter, just the type checker
pnpm boundaries     # dependency-cruiser — the layer map, enforced
pnpm test:coverage  # vitest with the 100% lines/statements/functions gate
```

A few things that trip people up:

- **There is no build step.** TypeScript runs directly through `tsx`; `tsc`
  is `--noEmit` only. Don't add a compile step.
- **The coverage gate is 100% lines/statements/functions**, not "high
  coverage." If you add a branch that genuinely cannot be exercised, exclude
  it explicitly in `packages/engine/vitest.config.ts` with a comment saying
  why — an unexplained exclusion is the same defect as an uncovered line.
- **`pnpm boundaries` is a real dependency-cruiser rule set**, not a lint
  suggestion. If your change needs a new import across a layer boundary, the
  layer map in `AGENTS.md` almost certainly says why that direction is
  refused; read it before adding an override.
- Tests never launch a real browser, open a socket, or touch the network —
  dependencies arrive by injection (`CommandDeps`, `ExecOptions.spawnFn`,
  and similar seams). If your change needs a new capability, add it to the
  fake runtime too (`run/__tests__/fake-runtime.ts`), not just the real one.

## Making a change

1. **Find the wiring checklist** in `AGENTS.md` for the kind of change you're
   making (new journey check, new CLI command, new market, new config key,
   new egress provider, new browser engine, …). Most changes touch more than
   one file, and the checklist is the list.
2. **Write the test first if you can**, or alongside the change — this
   codebase treats "pinned by a test" as part of the definition of fixed, not
   an afterthought.
3. **Keep the change scoped.** A PR that renames something unrelated while
   fixing a bug is two PRs pretending to be one, and harder to review either
   way.
4. Run the three gates locally. `pnpm --filter @farsyn/engine exec vitest run
   <path> -t "<name>"` runs one test fast while you iterate.

## Sign your commits (DCO)

Farsyn uses the [Developer Certificate of Origin](https://developercertificate.org/)
instead of a CLA — the project is Apache-2.0 and stays that way, so there's no
need to collect the extra rights a CLA exists to grant. Every commit needs a
`Signed-off-by` trailer certifying you wrote it or otherwise have the right to
submit it under the project's license:

```bash
git commit -s -m "your commit message"
```

`-s` appends the trailer automatically. If you forgot it on an existing
commit: `git commit --amend -s` (or `git rebase --signoff` for a range). A PR
missing sign-off will be flagged by CI and needs a fix before it can merge.

## Opening the PR

- Fill in the PR template — in particular "which invariant does this touch?"
  and "does this need an e2e case?". If the change is behavioral rather than
  cosmetic, it should be obvious from the template which of the 41 invariants
  in `AGENTS.md` it interacts with.
- Reference the issue it closes, if there is one.
- Expect review against `AGENTS.md`'s conventions, not just "does it work" —
  a fix that works but reintroduces a pattern the codebase deliberately
  avoids (see the invariants) will get a comment pointing at why.

## Reporting a bug

If the bug is "farsyn reported something about a site that isn't true," see
the `false_verdict` issue template — this project's whole claim is that a
failing run is reproducible, and that template collects exactly what's needed
to prove or disprove it (run id, evidence manifest, engine, profile, seed).

For anything security-sensitive, see [`SECURITY.md`](SECURITY.md) instead of
opening a public issue.
