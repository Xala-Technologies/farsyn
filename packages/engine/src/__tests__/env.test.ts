import { describe, expect, it, vi } from "vitest";
import { withLegacyEnv } from "../env.js";

describe("withLegacyEnv", () => {
  it("mirrors a legacy GEOQA_ variable onto its FARSYN_ name", () => {
    const out = withLegacyEnv({ GEOQA_API_TOKEN: "secret" }, () => undefined);
    expect(out.FARSYN_API_TOKEN).toBe("secret");
    // The legacy key stays too — nothing reads it directly any more, but wiping it
    // would be a second, unrelated change to hand the caller.
    expect(out.GEOQA_API_TOKEN).toBe("secret");
  });

  it("never overwrites an already-set FARSYN_ value with the legacy one", () => {
    // An operator migrating one variable at a time must not be fought by the shim
    // reasserting the old value over the new.
    const out = withLegacyEnv({ GEOQA_API_TOKEN: "old", FARSYN_API_TOKEN: "new" }, () => undefined);
    expect(out.FARSYN_API_TOKEN).toBe("new");
  });

  it("mirrors a DYNAMIC per-market key by prefix, not a fixed list", () => {
    // GEOQA_PROXY_<MARKET> has one row per city a tenant configures — a fixed
    // list would need a new entry for every market added after this shipped.
    const out = withLegacyEnv({ GEOQA_PROXY_BERGEN: "http://u:p@gw:8881" }, () => undefined);
    expect(out.FARSYN_PROXY_BERGEN).toBe("http://u:p@gw:8881");
  });

  it("ignores a key that only shares the prefix by accident of an unset value", () => {
    const out = withLegacyEnv({ GEOQA_API_TOKEN: undefined }, () => undefined);
    expect(out.FARSYN_API_TOKEN).toBeUndefined();
  });

  it("leaves every non-GEOQA_ key untouched", () => {
    const out = withLegacyEnv({ PATH: "/usr/bin", HOME: "/root" }, () => undefined);
    expect(out).toEqual({ PATH: "/usr/bin", HOME: "/root" });
  });

  it("warns once, naming every migrated variable, when at least one legacy key was read", () => {
    const warn = vi.fn();
    withLegacyEnv({ GEOQA_API_TOKEN: "a", GEOQA_MCP_HOST: "b" }, warn);
    expect(warn).toHaveBeenCalledTimes(1);
    const [line] = warn.mock.calls[0] as [string];
    expect(line).toContain("GEOQA_API_TOKEN");
    expect(line).toContain("GEOQA_MCP_HOST");
    expect(line).toContain("FARSYN_");
  });

  it("stays silent when nothing legacy was set", () => {
    const warn = vi.fn();
    withLegacyEnv({ FARSYN_API_TOKEN: "a" }, warn);
    expect(warn).not.toHaveBeenCalled();
  });

  it("defaults the warn sink to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    withLegacyEnv({ GEOQA_API_TOKEN: "a" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
