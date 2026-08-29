/**
 * The committed input trees, loaded the way a run loads them.
 *
 * Profiles, journeys, the tenant file, its overrides, watch, keywords and
 * experiment records are data, not code. A file that does not parse is a
 * silent hole in the matrix: the suite that only exercised fixtures would
 * stay green while `farsyn journey run` refused the name on the watch.
 *
 * `watch/store` tests deliberately never point at `tenants/example/watch.yaml`
 * so they cannot rewrite it. This file is the one that reads the committed
 * trees, and it is read-only.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXPERIMENTS } from "../experiments/definitions.js";
import { loadGeoProfile } from "../geo/profile.js";
import { loadJourney } from "../journeys/spec.js";
import { loadKeywordSeeds } from "../keywords/seeds.js";
import {
  bundledInputsRoot,
  experimentsRoot,
  findRepoRoot,
  journeysRoot,
  profilesRoot,
  tenantsRoot,
} from "../repo.js";
import { loadTenant } from "../tenant/registry.js";
import { loadWatch } from "../watch/store.js";

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
// The shared catalog now ships inside the engine package, not at the repo root —
// tenants and experiments are still workspace data, so they stay on `repoRoot`.
const bundled = bundledInputsRoot();
// Profiles and journeys are JSON now; the tenant registry, `watch.yaml` and
// `keywords.yaml` stay YAML (`repo.ts`'s `mergedJsonFilenames` docstring).
const jsonIn = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];

describe("shared profiles", () => {
  const dir = profilesRoot(bundled);
  const files = jsonIn(dir);

  it.each(files)("%s parses, id matches filename, and never sets isMobile or emulate", (file) => {
    const full = path.join(dir, file);
    const loaded = loadGeoProfile(full, (p) => readFileSync(p, "utf8"));
    if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
    expect(loaded.value.id).toBe(file.replace(/\.json$/, ""));
    expect(loaded.value.device.emulate).toBeUndefined();
    const raw = JSON.parse(readFileSync(full, "utf8")) as { device?: Record<string, unknown> };
    expect(raw.device).not.toHaveProperty("emulate");
    expect(raw.device).not.toHaveProperty("isMobile");
  });

  it("gives every market a mobile 390×844 and a desktop 1440×900", () => {
    const pairs = files.filter((f) => /-(mobile|desktop)\.json$/.test(f));
    const cities = [...new Set(pairs.map((f) => f.replace(/-(mobile|desktop)\.json$/, "")))];
    for (const city of cities) {
      const mobile = loadGeoProfile(path.join(dir, `${city}-mobile.json`));
      const desktop = loadGeoProfile(path.join(dir, `${city}-desktop.json`));
      if (!mobile.ok || !desktop.ok) throw new Error(`${city}: ${[...(!mobile.ok ? mobile.errors : []), ...(!desktop.ok ? desktop.errors : [])].join()}`);
      expect(mobile.value.device.viewport).toEqual({ width: 390, height: 844 });
      expect(desktop.value.device.viewport).toEqual({ width: 1440, height: 900 });
      expect(mobile.value.market.id).toBe(city);
      expect(desktop.value.market.id).toBe(city);
    }
  });
});

describe("shared journeys", () => {
  const dir = journeysRoot(bundled);
  const files = jsonIn(dir);

  it.each(files)("%s parses and its id matches its filename", (file) => {
    const loaded = loadJourney(path.join(dir, file), (p) => readFileSync(p, "utf8"));
    if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
    expect(loaded.value.id).toBe(file.replace(/\.json$/, ""));
  });
});

describe("tenant example", () => {
  const tenantsDir = tenantsRoot(repoRoot);
  const tenantFile = path.join(tenantsDir, "example.yaml");
  const tenantJourneys = path.join(tenantsDir, "example", "journeys");
  const tenant = loadTenant(tenantFile, (p) => readFileSync(p, "utf8"));
  if (!tenant.ok) throw new Error(tenant.errors.join("\n"));

  it("loads, and every market has both device profiles on disk", () => {
    expect(tenant.value.id).toBe("example");
    const profiles = new Set(jsonIn(profilesRoot(bundled)).map((f) => f.replace(/\.json$/, "")));
    for (const market of tenant.value.markets) {
      expect(profiles, `${market} mobile`).toContain(`${market}-mobile`);
      expect(profiles, `${market} desktop`).toContain(`${market}-desktop`);
    }
  });

  it.each(jsonIn(tenantJourneys))("override %s parses, and its id matches its filename", (file) => {
    const loaded = loadJourney(path.join(tenantJourneys, file), (p) => readFileSync(p, "utf8"));
    if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
    expect(loaded.value.id).toBe(file.replace(/\.json$/, ""));
  });

  it("keywords parse, and a scoped market is one this tenant asked about", () => {
    const loaded = loadKeywordSeeds(path.join(tenantsDir, "example", "keywords.yaml"), (p) =>
      readFileSync(p, "utf8"),
    );
    if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
    expect(loaded.value.length).toBeGreaterThan(0);
    for (const seed of loaded.value) {
      for (const market of seed.markets ?? []) {
        expect(tenant.value.markets, market).toContain(market);
      }
    }
  });

  it("watch.yaml parses as the worked example it documents itself as, and every name it uses exists", () => {
    const watch = loadWatch(path.join(tenantsDir, "example", "watch.yaml"), (p) => readFileSync(p, "utf8"));
    if (!watch.ok) throw new Error(watch.errors.join("\n"));
    expect(watch.value.tenantId).toBe("example");
    expect(watch.value.journeyPick).toBe("seeded");
    expect(watch.value.allowWrites).toBe(false);
    // Shipped disabled on purpose: a worked example is not a schedule anyone
    // should actually run against example.com.
    expect(watch.value.enabled).toBe(false);
    expect(watch.value.mode).toBe("periodic");

    for (const market of watch.value.markets) {
      expect(tenant.value.markets, market).toContain(market);
    }
    for (const target of watch.value.targets) {
      expect(tenant.value.targets, target).toContain(new URL(target).origin);
    }
    const journeyIds = new Set([
      ...jsonIn(journeysRoot(bundled)).map((f) => f.replace(/\.json$/, "")),
      ...jsonIn(tenantJourneys).map((f) => f.replace(/\.json$/, "")),
    ]);
    const writes = new Set(
      [...jsonIn(journeysRoot(bundled)), ...jsonIn(tenantJourneys)].flatMap((file) => {
        const root = jsonIn(tenantJourneys).includes(file) ? tenantJourneys : journeysRoot(bundled);
        const loaded = loadJourney(path.join(root, file));
        return loaded.ok && loaded.value.writes ? [loaded.value.id] : [];
      }),
    );
    for (const id of watch.value.journeys) {
      expect(journeyIds, id).toContain(id);
      if (!watch.value.allowWrites) expect(writes.has(id), id).toBe(false);
    }
    for (const e2e of watch.value.e2e.journeys) {
      expect(journeyIds, e2e.journey).toContain(e2e.journey);
      expect(tenant.value.markets, e2e.market).toContain(e2e.market);
    }
    for (const [url, pool] of Object.entries(watch.value.targetJourneys)) {
      expect(watch.value.targets, url).toContain(url);
      for (const id of pool) {
        expect(journeyIds, id).toContain(id);
        if (!watch.value.allowWrites) expect(writes.has(id), id).toBe(false);
      }
    }
  });
});

describe("experiments on disk", () => {
  const dir = experimentsRoot(repoRoot);
  const folders = readdirSync(dir).filter((name) => name.startsWith("EXP-")).sort();

  it("has one directory per registered experiment, and each record is JSON", () => {
    expect(folders).toEqual([...Object.keys(EXPERIMENTS)].sort());
    for (const folder of folders) {
      const hypothesis = JSON.parse(readFileSync(path.join(dir, folder, "hypothesis.json"), "utf8")) as { id: string };
      expect(hypothesis.id).toBe(folder);
      JSON.parse(readFileSync(path.join(dir, folder, "configuration.json"), "utf8"));
      JSON.parse(readFileSync(path.join(dir, folder, "summary.json"), "utf8"));
    }
  });
});
