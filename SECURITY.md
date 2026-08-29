# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Use GitHub's private vulnerability reporting instead: go to the
[Security tab](../../security/advisories/new) of this repository and click
"Report a vulnerability". This opens a private advisory visible only to you
and the maintainers, and lets us collaborate on a fix before anything is
disclosed.

If you cannot use GitHub's reporting UI for some reason, email
**info@xala.no** instead. Either way, please include:

- What you found and why it's a security issue, not just a bug
- Steps to reproduce, or a minimal proof of concept
- The version or commit you tested against
- Your assessment of impact, if you have one

We aim to acknowledge a report within **5 business days** and to agree on a
disclosure timeline with you — our default is **90 days** from
acknowledgment, matching common industry practice, sooner if a fix ships
sooner. We'll credit you in the advisory unless you'd rather stay anonymous.

## Supported versions

Farsyn is pre-1.0 (`0.x`). Until a `1.0` release, only the latest published
version of `@farsyn/engine` and `@farsyn/mcp` receives security fixes — there
is no LTS branch yet.

## This project's threat model

Farsyn is not a typical library, and a few things about what it does are
directly relevant to what "a security issue" means here:

- **It drives a real browser against third-party sites you name.** A
  vulnerability that let a crafted target page escape the browser sandbox,
  exfiltrate the evidence root, or pivot into the host running `farsyn` is
  the most serious class we can receive. This includes both browser engines
  (`agent-browser` and Playwright) and anything in `journeys/` that evaluates
  page content.
- **It handles proxy credentials.** Proxy credentials come from
  `FARSYN_PROXY_*` environment variables only — never from
  `farsyn.config.json`, which refuses a credential-shaped key by name (see
  invariant 11 in [`AGENTS.md`](AGENTS.md)). Any code path that could cause a
  credential to reach disk, a log line, or a redacted-but-reconstructible
  string is a security issue, not a bug report.
- **It writes evidence that can contain PII.** A run against a real site can
  capture a screenshot mid-form-fill, a network log with request bodies, or a
  filled login field. Redaction happens **at write time**
  (`evidence/redact.ts`, invariant 11), and a filled value is masked
  everywhere it could otherwise leak (invariant 14). A gap in that
  redaction — a value that reaches `run.json`, a manifest, or a log line
  unmasked — is a security issue.
- **A run can change state on a real, third-party system.** Journeys that
  `writes: true` submit real forms, register real accounts, or perform real
  CRUD against whatever URL you point them at. This is by design and
  disclosed in every such run's output, but a bug that caused a *read-only*
  journey to write, or caused writes against a target the operator did not
  name, is a security issue.
- **Tenant data is meant to be contained.** `containedPath` (invariant 24)
  refuses any resolved path that would escape a tenant's own evidence root.
  A path that gets past it and reads or writes outside that boundary is a
  security issue, full stop — see invariant 24 for why containment is
  `path.relative`-based rather than a prefix check.

None of the above is exhaustive. If something you found doesn't fit neatly
into one of these but still feels like "an attacker could use this to do
something the operator didn't intend," report it — we'd rather triage a
false positive than miss a real one.

## Out of scope

- Vulnerabilities in a **target site** you point `farsyn` at — that's the
  site's own security team's problem, not this project's.
- Vulnerabilities that require an attacker to already control
  `farsyn.config.json`, the evidence root, or the `FARSYN_*` environment on
  the machine running it — at that point they already have the access the
  report would grant.
- Findings from automated scanners with no demonstrated exploitability
  against this codebase specifically.
