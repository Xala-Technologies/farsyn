/**
 * The look-back window for a digest. `24h` is the daily default.
 * An ISO instant is allowed so a missed day can be replayed.
 */

/**
 * Resolve who a digest mails to: the flag, then `FARSYN_DIGEST_TO`, or `null`
 * if neither is set.
 *
 * There is deliberately no operator default. A digest can name a specific
 * page's owner and their inbox is not something this engine gets to guess —
 * an unconfigured recipient is a reason to refuse sending, not a reason to
 * mail whoever last edited this file.
 */
export function resolveDigestTo(flag: string | undefined, env: NodeJS.ProcessEnv): string | null {
  if (flag !== undefined && flag !== "") return flag;
  const named = env.FARSYN_DIGEST_TO;
  if (named !== undefined && named !== "") return named;
  return null;
}

export function parseDigestWindow(
  raw: string | undefined,
  nowMs: number,
): { ok: true; sinceMs: number } | { ok: false; error: string } {
  if (raw === undefined || raw === "") return { ok: true, sinceMs: nowMs - 24 * 60 * 60_000 };
  const hours = /^([1-9]\d*)h$/.exec(raw);
  if (hours !== null) {
    const n = Number(hours[1]);
    return { ok: true, sinceMs: nowMs - n * 60 * 60_000 };
  }
  const ms = Date.parse(raw);
  if (Number.isFinite(ms)) return { ok: true, sinceMs: ms };
  return { ok: false, error: `since must be Nh (12h, 24h) or an ISO instant, not ${raw}` };
}
