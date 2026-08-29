/**
 * Two roots, not one — where the ENGINE's own catalog ships, and where a
 * WORKSPACE's own data lives.
 *
 * The bundled catalog (`packages/engine/inputs/profiles`,
 * `packages/engine/inputs/journeys`) travels inside the npm package: it is
 * what a fresh `npm install -g @farsyn/engine` already has, with no git
 * clone and no `pnpm-workspace.yaml` anywhere on disk. A workspace is
 * writable and local: tenant configs, custom profiles or journeys that
 * override the bundled set, run evidence, secrets. `resolveWorkspace`
 * finds it — `--home` flag, then `FARSYN_HOME`, then `paths.home` in
 * `farsyn.config.json`, then (only inside the monorepo checkout) the repo
 * root a contributor is already standing in, then `~/.farsyn`.
 *
 * A profile or journey resolves workspace-first: `<home>/inputs/profiles/
 * oslo-mobile.json` REPLACES the bundled one of the same name, exactly as a
 * tenant's own file already replaces the shared set in `resolveDataPath`
 * (`cli/commands.ts`) — this is that same rule one level up, not a new one.
 * That is a deliberate reversal of this file's own former guidance, which
 * warned that a nested `inputs/profiles/` silently shadowing the shared set
 * was the failure to avoid; here, a home overlay winning is the feature.
 *
 * Every path resolved from a workspace-supplied root still goes through
 * `containedPath` at its call site before being read or written — `home` is
 * user input now, not a value this file discovered by walking upward, and
 * the containment invariant does not get to lapse just because the case that
 * needed it moved.
 */
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INPUTS_DIR = "inputs";
export const VAR_DIR = "var";

export const PROFILES_SEGMENTS = [INPUTS_DIR, "profiles"] as const;
export const JOURNEYS_SEGMENTS = [INPUTS_DIR, "journeys"] as const;
export const TENANTS_SEGMENTS = [INPUTS_DIR, "tenants"] as const;
export const EXPERIMENTS_SEGMENTS = [INPUTS_DIR, "experiments"] as const;
export const IMPORTS_SEGMENTS = [INPUTS_DIR, "imports"] as const;
export const EVIDENCE_SEGMENTS = [VAR_DIR, "evidence"] as const;
export const SECRETS_SEGMENTS = [VAR_DIR, "secrets"] as const;

/** Where `pnpm ui:build` writes, relative to the git root. */
export const UI_DIST_SEGMENTS = ["apps", "ui", "dist"] as const;

/** Highest-precedence-but-one for the workspace root; `--home` outranks it. */
export const HOME_ENV_VAR = "FARSYN_HOME";

export function profilesRoot(root: string): string {
  return path.join(root, ...PROFILES_SEGMENTS);
}

export function journeysRoot(root: string): string {
  return path.join(root, ...JOURNEYS_SEGMENTS);
}

export function tenantsRoot(root: string): string {
  return path.join(root, ...TENANTS_SEGMENTS);
}

export function experimentsRoot(root: string): string {
  return path.join(root, ...EXPERIMENTS_SEGMENTS);
}

export function importsRoot(root: string): string {
  return path.join(root, ...IMPORTS_SEGMENTS);
}

export function defaultEvidenceRoot(root: string): string {
  return path.join(root, ...EVIDENCE_SEGMENTS);
}

export function secretsRoot(root: string): string {
  return path.join(root, ...SECRETS_SEGMENTS);
}

export function uiDistRoot(repoRoot: string): string {
  return path.join(repoRoot, ...UI_DIST_SEGMENTS);
}

/**
 * `~/.farsyn` — where a workspace lives when nothing names one. `HOME` is
 * read explicitly before falling back to `os.homedir()` so a test can pin it
 * without touching the real one, and because `os.homedir()` ignores `HOME`
 * on some platforms in ways a self-hosted operator's `.env` should still be
 * able to override.
 */
export function defaultHome(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.HOME ?? os.homedir();
  return path.join(base, ".farsyn");
}

/**
 * The engine package's own directory, resolved from THIS module's location
 * rather than from `cwd` or an upward search — the bundled catalog must be
 * found the same way whether `repo.js` is running from the monorepo's
 * `packages/engine/src/` or from a `node_modules/@farsyn/engine/` install,
 * and neither of those is guaranteed to be anywhere near the process's
 * working directory.
 */
export function packageRoot(from: string = fileURLToPath(import.meta.url)): string {
  return path.resolve(path.dirname(from), "..");
}

/**
 * The root of the bundled, read-only catalog that ships inside the npm
 * package — same contract as `home`: a directory `profilesRoot`/
 * `journeysRoot` can be pointed at, which is why this returns the PACKAGE
 * root rather than `<packageRoot>/inputs` itself.
 */
export function bundledInputsRoot(pkgRoot: string = packageRoot()): string {
  return pkgRoot;
}

/**
 * The farsyn monorepo checkout, found by markers rather than by counting
 * `..` — a package that lives at `packages/engine/src/cli` is two segments
 * deeper than it used to be, and encoding that depth in every entrypoint is
 * how a run looks for `packages/engine/profiles` and reports every market
 * missing.
 *
 * The marker is `pnpm-workspace.yaml` plus the bundled catalog sitting where
 * it now lives (`packages/engine/inputs/{profiles,journeys}`) — checking all
 * three the way the original marker checked `inputs/profiles` and
 * `inputs/journeys` at the workspace root, before they moved into the
 * package.
 *
 * Returns `null` rather than throwing: this is a dev-mode DETECTION, not a
 * requirement. An installed package has nothing above it that looks like
 * this repo, and that is the ordinary case, not an error — `resolveWorkspace`
 * falls through to `~/.farsyn` when it is `null`.
 */
export function findMonorepoRoot(from: string, exists: (p: string) => boolean = existsSync): string | null {
  let dir = path.resolve(from);
  for (;;) {
    const bundled = path.join(dir, "packages", "engine", INPUTS_DIR);
    if (
      exists(path.join(dir, "pnpm-workspace.yaml")) &&
      exists(path.join(bundled, "profiles")) &&
      exists(path.join(bundled, "journeys"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Back-compat form of `findMonorepoRoot` for the one caller that genuinely
 * requires being inside the checkout (`apps/console`, which starts the UI
 * dev server and the API from the monorepo's own `apps/ui/dist` — it has no
 * standalone existence to fall back to). Everything else should call
 * `resolveWorkspace` instead, which treats "not in the monorepo" as the
 * normal case rather than a failure.
 */
export function findRepoRoot(from: string, exists: (p: string) => boolean = existsSync): string {
  const found = findMonorepoRoot(from, exists);
  if (found !== null) return found;
  throw new Error(
    `could not find the farsyn repo root from ${from} — expected pnpm-workspace.yaml and packages/engine/inputs/{profiles,journeys}`,
  );
}

export interface ResolveWorkspaceOptions {
  /** `--home`, if the caller passed one — highest precedence. */
  homeFlag?: string;
  env?: NodeJS.ProcessEnv;
  /**
   * `paths.home` from an already-loaded `farsyn.config.json`. The config
   * file itself is found and read BEFORE this function decides the final
   * home (see `cli/index.ts`), so this only ever redirects the DATA root —
   * it cannot relocate the config file that named it, which avoids a
   * circular "the config tells you where to find the config" reload.
   */
  configHome?: string;
  /** Where the running entrypoint lives, for monorepo detection. */
  from: string;
  exists?: (p: string) => boolean;
}

export interface Workspace {
  /** Writable: tenants, a home overlay for profiles/journeys, var/evidence, var/secrets. */
  home: string;
  /** Read-only: the catalog that ships with the engine package. */
  bundled: string;
  /** True when `home` is the monorepo checkout itself — a contributor's normal case. */
  isMonorepo: boolean;
}

/**
 * `--home` > `FARSYN_HOME` > `paths.home` > the monorepo checkout (if this
 * process is running from inside one) > `~/.farsyn`.
 *
 * Flag and env outrank the monorepo deliberately: a contributor working
 * inside the checkout who ALSO sets `--home` (to point a matrix at a
 * scratch tenant directory, say) means it, and the checkout winning anyway
 * would make the override look ignored.
 */
export function resolveWorkspace(options: ResolveWorkspaceOptions): Workspace {
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const monorepo = findMonorepoRoot(options.from, exists);
  const home = options.homeFlag || env[HOME_ENV_VAR] || options.configHome || monorepo || defaultHome(env);
  return { home, bundled: bundledInputsRoot(), isMonorepo: monorepo !== null && home === monorepo };
}

/**
 * Every `.json` filename across a list of directories, earlier entries
 * winning — a later directory can supply what an earlier one is missing but
 * never override what it already has. A missing directory is silently empty:
 * a fresh workspace need not have created every tree yet, and that is not
 * the same defect as a typo'd path.
 *
 * Profiles and journeys only — a tenant's own registry entry and its
 * `keywords.yaml`/`watch.yaml` stay YAML (`tenant/registry.ts`, `watch/store.ts`)
 * and are never routed through here.
 */
export function mergedJsonFilenames(
  dirs: string[],
  exists: (p: string) => boolean = existsSync,
  list: (p: string) => string[] = (p) => readdirSync(p),
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const dir of dirs) {
    if (!exists(dir)) continue;
    for (const file of list(dir)) {
      if (!file.endsWith(".json") || seen.has(file)) continue;
      seen.add(file);
      out.push(file);
    }
  }
  return out;
}
