/**
 * One release of backward compatibility for the `GEOQA_` → `FARSYN_` rename.
 *
 * geoqa shipped every setting as `GEOQA_*`; renaming the brand must not silently
 * strand an operator's existing `.env`, systemd unit or CI secret on the day this
 * ships — that is exactly the kind of "the run ignored it and nothing said so"
 * defect the config surface exists to prevent (R-17), just aimed at environment
 * variables instead of `geoqa.config.json`.
 *
 * Every `GEOQA_<X>` is mirrored onto `FARSYN_<X>` when the new name is not
 * already set, by PREFIX rather than a fixed list — `GEOQA_PROXY_<MARKET>` is a
 * family with one row per city, and a fixed list would need a new entry for
 * every market a tenant adds. An explicitly-set `FARSYN_<X>` always wins over its
 * legacy twin, so an operator migrating one variable at a time is never fought.
 *
 * Delete this module and its one call site in the next release; it is not meant
 * to be permanent.
 */
const LEGACY_PREFIX = "GEOQA_";
const CURRENT_PREFIX = "FARSYN_";

export function withLegacyEnv(env: NodeJS.ProcessEnv, warn: (line: string) => void = console.error): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  const migrated: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(LEGACY_PREFIX) || value === undefined) continue;
    const renamed = `${CURRENT_PREFIX}${key.slice(LEGACY_PREFIX.length)}`;
    if (out[renamed] === undefined) {
      out[renamed] = value;
      migrated.push(key);
    }
  }
  if (migrated.length > 0) {
    warn(
      `warning: reading ${migrated.length} legacy GEOQA_* variable(s) (${migrated.sort().join(", ")}) — ` +
        "rename to FARSYN_*, the GEOQA_ names are honoured for one release only",
    );
  }
  return out;
}
