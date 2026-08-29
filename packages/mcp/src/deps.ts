/**
 * Build the same `CommandDeps` the CLI uses, from environment variables.
 *
 * MCP runs as a long-lived stdio process: logging every tool call to stderr would
 * corrupt nothing (stdout is JSON-RPC) but would flood the client's log. The deps
 * therefore use a silent logger unless `FARSYN_MCP_VERBOSE=1`.
 */
import path from "node:path";
import {
  defaultDeps,
  resolveEngineWorkspace,
  resolveEvidenceRoot,
  withLegacyEnv,
  type CommandDeps,
} from "@farsyn/engine/mcp.js";

export interface McpConfig {
  deps: CommandDeps;
  repoRoot: string;
  evidenceRoot: string;
  /** When set, live endpoints proxy to `farsyn server` instead of refusing. */
  serverUrl: string | null;
  apiToken: string | null;
}

/**
 * `FARSYN_REPO_ROOT` is this process's `--home`: an explicit, highest-precedence
 * override, kept under its original name because it predates `--home` and is
 * already documented for every deployed MCP install. `resolveEngineWorkspace`
 * still applies `FARSYN_HOME` and a config file's `paths.home` underneath it.
 */
export function createMcpConfig(env: NodeJS.ProcessEnv = withLegacyEnv(process.env), cwd = process.cwd()): McpConfig {
  const homeOpt =
    env.FARSYN_REPO_ROOT !== undefined && env.FARSYN_REPO_ROOT !== ""
      ? { homeFlag: path.resolve(env.FARSYN_REPO_ROOT) }
      : {};
  const resolved = resolveEngineWorkspace({ ...homeOpt, env, from: cwd });
  if (!resolved.ok) throw new Error(resolved.errors.join("\n"));
  const { workspace, config } = resolved;
  const repoRoot = workspace.home;

  const evidenceRoot = resolveEvidenceRoot(
    repoRoot,
    config.evidence.root,
    env.FARSYN_EVIDENCE_ROOT !== undefined && env.FARSYN_EVIDENCE_ROOT !== "" ? env.FARSYN_EVIDENCE_ROOT : undefined,
  );

  const verbose = env.FARSYN_MCP_VERBOSE === "1";
  const deps = defaultDeps(repoRoot, {
    bundledInputsRoot: workspace.bundled,
    evidenceRoot,
    env,
    log: verbose ? (line) => console.error(`[farsyn-mcp] ${line}`) : () => {},
    ...(env.FARSYN_TENANT !== undefined && env.FARSYN_TENANT !== "" ? { tenantId: env.FARSYN_TENANT } : {}),
  });

  const serverUrl = env.FARSYN_SERVER_URL !== undefined && env.FARSYN_SERVER_URL !== ""
    ? env.FARSYN_SERVER_URL.replace(/\/$/, "")
    : null;
  const apiToken = env.FARSYN_API_TOKEN !== undefined && env.FARSYN_API_TOKEN !== "" ? env.FARSYN_API_TOKEN : null;

  return { deps, repoRoot, evidenceRoot, serverUrl, apiToken };
}
