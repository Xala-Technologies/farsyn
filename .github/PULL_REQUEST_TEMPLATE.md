## What does this change, and why?

<!-- The "why" matters more than the "what" — the diff already shows the what. -->

## Which invariant does this touch?

<!--
See the "Load-bearing invariants" section of AGENTS.md. If this change
interacts with one (or several), name it/them and say how. If genuinely
none apply, say so explicitly rather than leaving this blank — a blank
answer and "I checked, none apply" look identical otherwise.
-->

## Does this need an e2e case?

<!--
If this change is about what a REAL BROWSER does (not just what we do with
a reading), it probably needs a case in e2e/*.e2e.ts. If it's a judgement
change over a reading the unit tests already inject, it probably doesn't.
See AGENTS.md's "Testing conventions" section.
-->

## Checklist

- [ ] `pnpm lint` passes (`tsc --noEmit`)
- [ ] `pnpm boundaries` passes (no layer violations)
- [ ] `pnpm test:coverage` passes at the 100% lines/statements/functions gate
- [ ] New/changed behavior is pinned by a test, not just exercised by one
- [ ] Any coverage exclusion added carries a comment naming why (see `vitest.config.ts`)
- [ ] Commits are signed off (`git commit -s`) — see `CONTRIBUTING.md`
- [ ] If this adds a journey check / CLI command / config key / egress provider / browser engine, the relevant wiring checklist in `AGENTS.md` was followed end to end

## Related issue

<!-- Closes #... , or "none" -->
