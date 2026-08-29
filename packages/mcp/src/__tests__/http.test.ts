import { describe, expect, it } from "vitest";
import { parseAllowedHosts } from "../http.js";

describe("parseAllowedHosts", () => {
  it("splits FARSYN_MCP_ALLOWED_HOSTS", () => {
    expect(
      parseAllowedHosts({ FARSYN_MCP_ALLOWED_HOSTS: "a.example.com, b.example.com" }, null),
    ).toEqual(["a.example.com", "b.example.com"]);
  });

  it("derives hostname from FARSYN_SERVER_URL", () => {
    expect(parseAllowedHosts({}, "https://farsyn.example.com")).toEqual([
      "farsyn.example.com",
      "127.0.0.1",
      "localhost",
    ]);
  });

  it("returns undefined when no hosts configured", () => {
    expect(parseAllowedHosts({}, null)).toBeUndefined();
  });
});
