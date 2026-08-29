#!/usr/bin/env node
/**
 * `farsyn` entrypoint. Runs the TypeScript CLI through tsx — there is no build
 * step, the source ships and executes directly.
 *
 * `node --import tsx`, not `npx tsx`: `npx` may reach for the network when a
 * local `tsx` cannot be found, which is the wrong failure mode for a CLI that
 * is supposed to work offline once installed. `tsx` is a real `dependencies`
 * entry on this package (not a devDependency) precisely so `--import` always
 * resolves it from here, the same way the MCP server's own bin scripts do.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "..", "src", "cli", "index.ts");

const child = spawn(process.execPath, ["--import", "tsx", cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
