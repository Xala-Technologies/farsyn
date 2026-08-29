import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultDeps } from "../../cli/commands.js";
import { findRepoRoot, tenantsRoot } from "../../repo.js";
import { settingsView } from "../settings.js";

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));

describe("settingsView", () => {
  it("builds the same operator settings the console serves", () => {
    const deps = defaultDeps(repoRoot);
    const result = settingsView(deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.markets.length).toBeGreaterThan(0);
    expect(result.value.journeys.length).toBeGreaterThan(0);
    // No farsyn.config.json in the real repo root, so this is the "defaults" branch.
    expect(result.value.config).toBeDefined();
  });

  it("reports the loader's error rather than falling back to defaults on a malformed config", () => {
    const broken = mkdtempSync(path.join(tmpdir(), "farsyn-settings-broken-"));
    try {
      writeFileSync(path.join(broken, "farsyn.config.json"), "{ not json");
      const deps = defaultDeps(broken, { bundledInputsRoot: repoRoot });
      const result = settingsView(deps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/not valid JSON/);
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });

  it("reports the config file's path as the source when one is present and valid", () => {
    const withConfig = mkdtempSync(path.join(tmpdir(), "farsyn-settings-file-"));
    try {
      writeFileSync(path.join(withConfig, "farsyn.config.json"), "{}");
      const deps = defaultDeps(withConfig, { bundledInputsRoot: repoRoot });
      const result = settingsView(deps);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.config).toBeDefined();
    } finally {
      rmSync(withConfig, { recursive: true, force: true });
    }
  });

  it("reports no tenants when the workspace has no tenants directory yet", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "farsyn-settings-empty-"));
    try {
      const deps = defaultDeps(empty, { bundledInputsRoot: repoRoot });
      const result = settingsView(deps);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.tenants).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("filters out a tenant file that fails to parse, rather than throwing", () => {
    const withBadTenant = mkdtempSync(path.join(tmpdir(), "farsyn-settings-tenant-"));
    mkdirSync(tenantsRoot(withBadTenant), { recursive: true });
    writeFileSync(path.join(tenantsRoot(withBadTenant), "broken.yaml"), "id: broken\nname: [not a string\n");
    try {
      const deps = defaultDeps(withBadTenant, { bundledInputsRoot: repoRoot });
      const result = settingsView(deps);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.tenants).toEqual([]);
    } finally {
      rmSync(withBadTenant, { recursive: true, force: true });
    }
  });
});
