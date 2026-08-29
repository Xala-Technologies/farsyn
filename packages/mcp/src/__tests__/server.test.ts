import { describe, expect, it } from "vitest";
import { createMcpConfig } from "../deps.js";
import { findRepoRoot, profileList, withLegacyEnv } from "@farsyn/engine/mcp.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));

describe("createMcpConfig", () => {
  it("resolves repo root and evidence from FARSYN_REPO_ROOT", () => {
    const config = createMcpConfig({ FARSYN_REPO_ROOT: repoRoot });
    expect(config.repoRoot).toBe(repoRoot);
    expect(config.evidenceRoot).toContain("var/evidence");
  });

  it("reads profiles through the same deps the MCP tools use", () => {
    const config = createMcpConfig({ FARSYN_REPO_ROOT: repoRoot });
    const result = profileList(config.deps);
    expect(result.profiles.length).toBeGreaterThan(0);
  });

  it("still resolves from the legacy GEOQA_REPO_ROOT, through the shim", () => {
    const config = createMcpConfig(withLegacyEnv({ GEOQA_REPO_ROOT: repoRoot }, () => undefined));
    expect(config.repoRoot).toBe(repoRoot);
  });

  it("defaults env to the process environment, shimmed, when omitted", () => {
    // Passing `undefined` explicitly (rather than a literal object) is what makes the
    // default parameter itself evaluate — exercising the real entrypoint's path, not
    // just the function called with an env every other test supplies.
    const config = createMcpConfig(undefined, repoRoot);
    expect(config.repoRoot).toBe(repoRoot);
  });
});
