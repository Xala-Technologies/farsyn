---
"@farsyn/engine": patch
"@farsyn/mcp": patch
---

Bump `vitest`/`@vitest/coverage-v8` to `^3.2.7`, clearing a critical Dependabot
advisory (arbitrary file read/execute when the Vitest UI server is listening)
and pulling in patched `vite`/`esbuild` transitively. Dev-tooling only — no
runtime code changed, and the full coverage/boundaries/typecheck gate is
unaffected (100% lines/statements/functions held exactly).
