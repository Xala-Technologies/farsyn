import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_SEGMENTS,
  EXPERIMENTS_SEGMENTS,
  IMPORTS_SEGMENTS,
  JOURNEYS_SEGMENTS,
  PROFILES_SEGMENTS,
  SECRETS_SEGMENTS,
  TENANTS_SEGMENTS,
  UI_DIST_SEGMENTS,
  bundledInputsRoot,
  defaultEvidenceRoot,
  defaultHome,
  experimentsRoot,
  findMonorepoRoot,
  findRepoRoot,
  importsRoot,
  journeysRoot,
  mergedJsonFilenames,
  profilesRoot,
  resolveWorkspace,
  secretsRoot,
  tenantsRoot,
  uiDistRoot,
} from "../repo.js";

describe("findRepoRoot", () => {
  const root = path.resolve("/repo");
  const nested = path.join(root, "packages", "engine", "src", "cli");
  // The bundled catalog now ships inside packages/engine/inputs/, not at the
  // workspace root — the marker moved with it.
  const bundled = path.join(root, "packages", "engine", "inputs");
  const present = new Set([
    path.join(root, "pnpm-workspace.yaml"),
    path.join(bundled, "profiles"),
    path.join(bundled, "journeys"),
  ]);
  const exists = (p: string): boolean => present.has(p);

  it("walks up from a nested package until the workspace markers are all present", () => {
    expect(findRepoRoot(nested, exists)).toBe(root);
  });

  it("does not stop at a directory that has only some of the markers", () => {
    // An intermediate directory with pnpm-workspace.yaml and half the bundled
    // catalog must not be mistaken for the real root — every marker is required
    // together, at the SAME directory.
    const decoy = path.join(root, "packages");
    const decoyMarkers = [
      path.join(decoy, "pnpm-workspace.yaml"),
      path.join(decoy, "packages", "engine", "inputs", "profiles"),
    ];
    for (const marker of decoyMarkers) present.add(marker);
    expect(findRepoRoot(nested, exists)).toBe(root);
    for (const marker of decoyMarkers) present.delete(marker);
  });

  it("throws rather than guessing when nothing above looks like this repo", () => {
    expect(() => findRepoRoot("/tmp/elsewhere", () => false)).toThrow(/pnpm-workspace.yaml/);
  });
});

describe("layout roots", () => {
  it("keeps committed inputs under inputs/ and local output under var/", () => {
    expect(profilesRoot("/repo")).toBe(path.join("/repo", "inputs", "profiles"));
    expect(journeysRoot("/repo")).toBe(path.join("/repo", "inputs", "journeys"));
    expect(tenantsRoot("/repo")).toBe(path.join("/repo", "inputs", "tenants"));
    expect(experimentsRoot("/repo")).toBe(path.join("/repo", "inputs", "experiments"));
    expect(importsRoot("/repo")).toBe(path.join("/repo", "inputs", "imports"));
    expect(defaultEvidenceRoot("/repo")).toBe(path.join("/repo", "var", "evidence"));
    expect(secretsRoot("/repo")).toBe(path.join("/repo", "var", "secrets"));
    expect(EVIDENCE_SEGMENTS).toEqual(["var", "evidence"]);
    expect(SECRETS_SEGMENTS).toEqual(["var", "secrets"]);
    expect(TENANTS_SEGMENTS).toEqual(["inputs", "tenants"]);
    expect(EXPERIMENTS_SEGMENTS).toEqual(["inputs", "experiments"]);
    expect(IMPORTS_SEGMENTS).toEqual(["inputs", "imports"]);
  });

  it("points at the console package build, not a root-level ui/", () => {
    expect(UI_DIST_SEGMENTS).toEqual(["apps", "ui", "dist"]);
    expect(uiDistRoot("/repo")).toBe(path.join("/repo", "apps", "ui", "dist"));
  });
});

describe("findMonorepoRoot", () => {
  it("returns null rather than throwing when nothing above looks like this repo — an installed package's ordinary case", () => {
    expect(findMonorepoRoot("/tmp/elsewhere", () => false)).toBeNull();
  });
});

describe("defaultHome", () => {
  it("reads HOME explicitly rather than trusting os.homedir(), so a test can pin it", () => {
    expect(defaultHome({ HOME: "/home/pinned" } as NodeJS.ProcessEnv)).toBe(path.join("/home/pinned", ".farsyn"));
  });
});

describe("resolveWorkspace", () => {
  const from = "/tmp/elsewhere";
  const noMonorepo = () => false;

  it("honours --home over everything else, including a discoverable monorepo", () => {
    const monorepoExists = (p: string): boolean => p.endsWith("pnpm-workspace.yaml") || p.includes(path.join("inputs"));
    const ws = resolveWorkspace({
      homeFlag: "/explicit/home",
      env: { FARSYN_HOME: "/env/home" } as NodeJS.ProcessEnv,
      configHome: "/config/home",
      from,
      exists: monorepoExists,
    });
    expect(ws.home).toBe("/explicit/home");
    // The monorepo WAS found, but home did not come from it — isMonorepo says so.
    expect(ws.isMonorepo).toBe(false);
  });

  it("falls back to FARSYN_HOME when there is no --home flag", () => {
    const ws = resolveWorkspace({ env: { FARSYN_HOME: "/env/home" } as NodeJS.ProcessEnv, from, exists: noMonorepo });
    expect(ws.home).toBe("/env/home");
    expect(ws.isMonorepo).toBe(false);
  });

  it("falls back to paths.home from an already-loaded config when flag and env are absent", () => {
    const ws = resolveWorkspace({ env: {} as NodeJS.ProcessEnv, configHome: "/config/home", from, exists: noMonorepo });
    expect(ws.home).toBe("/config/home");
    expect(ws.isMonorepo).toBe(false);
  });

  it("falls back to the monorepo checkout when nothing named a home explicitly", () => {
    const root = path.resolve("/repo");
    const bundled = path.join(root, "packages", "engine", "inputs");
    const present = new Set([path.join(root, "pnpm-workspace.yaml"), path.join(bundled, "profiles"), path.join(bundled, "journeys")]);
    const ws = resolveWorkspace({ env: {} as NodeJS.ProcessEnv, from: root, exists: (p) => present.has(p) });
    expect(ws.home).toBe(root);
    expect(ws.isMonorepo).toBe(true);
  });

  it("falls back to ~/.farsyn — the OS default — when nothing else applies, defaulting env to process.env", () => {
    const ws = resolveWorkspace({ from, exists: noMonorepo });
    expect(ws.home).toBe(defaultHome());
    expect(ws.isMonorepo).toBe(false);
    expect(ws.bundled.length).toBeGreaterThan(0);
  });
});

describe("mergedJsonFilenames", () => {
  it("merges .json filenames across directories, earlier directories winning on a duplicate", () => {
    const files: Record<string, string[]> = {
      "/home": ["oslo-mobile.json"],
      "/bundled": ["oslo-mobile.json", "bergen-mobile.json", "notes.txt"],
    };
    const result = mergedJsonFilenames(
      ["/home", "/bundled"],
      (p) => p in files,
      (p) => files[p] ?? [],
    );
    expect(result).toEqual(["oslo-mobile.json", "bergen-mobile.json"]);
  });

  it("silently skips a directory that does not exist yet — a fresh workspace need not have created every tree", () => {
    const result = mergedJsonFilenames(["/missing", "/present"], (p) => p === "/present", (p) =>
      p === "/present" ? ["a.json"] : [],
    );
    expect(result).toEqual(["a.json"]);
  });

  it("defaults to the real filesystem when no injected exists/list is given", () => {
    // The bundled profiles directory always ships at least one .json file.
    const result = mergedJsonFilenames([profilesRoot(bundledInputsRoot())]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((f) => f.endsWith(".json"))).toBe(true);
  });
});
