import { describe, expect, it } from "vitest";
import { routeTicket, siteLabel, type SiteRepo } from "../repos.js";

const sites: SiteRepo[] = [
  { host: "example.com", repo: "acme-org/marketing-site", base: "main" },
  { host: "app.example.com", repo: "acme-org/app-portal", base: "dev" },
  { host: "dashboard.example.com", repo: "acme-org/app-portal", base: "dev" },
  { host: "other.example", repo: "other-org/other-site", base: "main" },
];

describe("siteLabel", () => {
  it("is the host, so a filter on GitHub is the site the visitor saw", () => {
    expect(siteLabel("app.example.com")).toBe("site:app.example.com");
  });
});

describe("routeTicket", () => {
  it("sends a site finding to that host's repo, and a tenant's own map can start a PR on a non-main branch", () => {
    const app = routeTicket(
      { urgent: false, hosts: ["app.example.com"], site: "app.example.com" },
      sites,
      "Xala-Technologies/farsyn",
    );
    expect(app).toEqual({ repo: "acme-org/app-portal", base: "dev", site: "app.example.com" });
    const dashboard = routeTicket(
      { urgent: false, hosts: ["dashboard.example.com"], site: "dashboard.example.com" },
      sites,
      "Xala-Technologies/farsyn",
    );
    expect(dashboard).toEqual({ repo: "acme-org/app-portal", base: "dev", site: "dashboard.example.com" });
    const marketing = routeTicket(
      { urgent: false, hosts: ["example.com"], site: "example.com" },
      sites,
      "Xala-Technologies/farsyn",
    );
    expect(marketing.repo).toBe("acme-org/marketing-site");
    expect(marketing.base).toBe("main");
  });

  it("keeps instrumentation on farsyn/main even when the run hit a mapped host", () => {
    const dest = routeTicket(
      { urgent: true, hosts: ["example.com", "other.example"], site: "farsyn" },
      sites,
      "Xala-Technologies/farsyn",
    );
    expect(dest).toEqual({ repo: "Xala-Technologies/farsyn", base: "main", site: "farsyn" });
  });

  it("an unmapped host stays on the fallback repo rather than inventing a destination", () => {
    const dest = routeTicket(
      { urgent: false, hosts: ["dev.example.com"], site: "dev.example.com" },
      sites,
      "Xala-Technologies/farsyn",
    );
    expect(dest).toEqual({ repo: "Xala-Technologies/farsyn", base: "main", site: "dev.example.com" });
  });
});
