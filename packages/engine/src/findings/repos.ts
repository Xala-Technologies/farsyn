/**
 * Where a finding is filed, and which branch a repair PR starts from.
 *
 * Site checks belong on the site's repo. Instrumentation and a proxy-vendor
 * miss belong on farsyn — they are ours or the vendor's, not a page defect.
 * A tenant's own site map can point any host at a non-`main` working branch;
 * this module has no opinion about which.
 *
 * Pure. The tenant file supplies the map; this module does not load it.
 */

export interface SiteRepo {
  host: string;
  repo: string;
  base: string;
}

export interface TicketRoute {
  repo: string;
  base: string;
  site: string;
}

export const siteLabel = (host: string): string => `site:${host}`;

export function routeTicket(
  draft: { urgent: boolean; hosts: string[]; site: string },
  sites: readonly SiteRepo[],
  fallbackRepo: string,
): TicketRoute {
  if (draft.urgent) {
    return { repo: fallbackRepo, base: "main", site: "farsyn" };
  }
  const host = draft.hosts[0] ?? draft.site;
  const mapped = sites.find((entry) => entry.host === host);
  if (mapped === undefined) {
    return { repo: fallbackRepo, base: "main", site: host };
  }
  return { repo: mapped.repo, base: mapped.base, site: host };
}
