import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultDeps, digestSend, renderDigestResult } from "../commands.js";
import { findRepoRoot } from "../../repo.js";

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
let evidenceRoot: string;
beforeEach(() => {
  evidenceRoot = mkdtempSync(path.join(tmpdir(), "farsyn-digest-"));
});
afterEach(() => {
  rmSync(evidenceRoot, { recursive: true, force: true });
});

const record = (): string =>
  JSON.stringify({
    schemaVersion: 1,
    runId: "run_1",
    tenantId: "example",
    target: "https://example.com/",
    profileId: "oslo-desktop",
    journeyId: "landing-page",
    verdict: "PASS",
    startedAt: "2026-08-18T12:00:00.000Z",
    durationMs: 1000,
    seed: 1,
    engine: "playwright",
    evidenceId: "ev_1",
    findings: { total: 0, bySeverity: {}, byCategory: {}, labels: [] },
    confidence: { overall: 100, geo: 100, browser: 100, journey: 100, evidence: 100 },
    geo: {
      requestedCountry: "NO",
      requestedCity: "Oslo",
      observedCountry: "NO",
      observedCity: "Oslo",
      country: "match",
      city: "match",
      egressHeld: "match",
      agreement: "unverified",
    },
    latencyMs: 80,
    vitals: { lcp: 400, cls: 0, ttfb: 20, inp: null },
  });

const env = {
  AGENTMAIL_API_KEY: "am_test",
  FARSYN_LOGIN_EMAIL: "login-e2e@agentmail.to",
  FARSYN_CONSOLE_URL: "https://farsyn.example",
  FARSYN_DIGEST_TO: "ops@example.com",
};

describe("digestSend", () => {
  it("refuses when mail is unconfigured or the window is not a duration", async () => {
    const bare = defaultDeps(repoRoot, { evidenceRoot, env: {}, now: () => Date.parse("2026-08-19T00:00:00.000Z"), log: () => undefined });
    const missing = await digestSend(bare);
    expect(missing).toMatchObject({ ok: false, skipped: "unconfigured" });
    expect(renderDigestResult(missing)).toContain("AGENTMAIL_API_KEY");
    const keyOnly = defaultDeps(repoRoot, {
      evidenceRoot,
      env: { AGENTMAIL_API_KEY: "am_test" },
      now: () => 1,
      log: () => undefined,
    });
    expect((await digestSend(keyOnly)).ok).toBe(false);
    const inboxOnly = defaultDeps(repoRoot, {
      evidenceRoot,
      env: { FARSYN_LOGIN_EMAIL: "login-e2e@agentmail.to" },
      now: () => 1,
      log: () => undefined,
    });
    expect((await digestSend(inboxOnly)).ok).toBe(false);
    const noRecipient = defaultDeps(repoRoot, {
      evidenceRoot,
      env: { AGENTMAIL_API_KEY: "am_test", FARSYN_LOGIN_EMAIL: "login-e2e@agentmail.to" },
      now: () => 1,
      log: () => undefined,
    });
    expect((await digestSend(noRecipient)).ok).toBe(false);

    const d = defaultDeps(repoRoot, { evidenceRoot, env, now: () => Date.parse("2026-08-19T00:00:00.000Z"), log: () => undefined });
    const bad = await digestSend(d, { since: "yesterday" });
    expect(bad).toMatchObject({ ok: false, skipped: "bad-window" });
    expect(renderDigestResult(bad)).toContain("ISO");
  });

  it("skips an unreadable store rather than mailing an empty issues section", async () => {
    writeFileSync(path.join(evidenceRoot, "filed-issues.json"), "{");
    const d = defaultDeps(repoRoot, { evidenceRoot, env, now: () => Date.parse("2026-08-19T00:00:00.000Z"), log: () => undefined });
    const out = await digestSend(d);
    expect(out).toMatchObject({ ok: false, skipped: "store-unreadable" });
    expect(renderDigestResult(out)).toContain("will not parse");
    writeFileSync(path.join(evidenceRoot, "filed-issues.json"), `${JSON.stringify({ issues: [] })}\n`);
    writeFileSync(path.join(evidenceRoot, "repaired-issues.json"), "{");
    const repaired = await digestSend(d);
    expect(repaired).toMatchObject({ ok: false, skipped: "store-unreadable" });
  });

  it("assembles a dry run and sends html without putting the key in the body", async () => {
    writeFileSync(path.join(evidenceRoot, "runs.jsonl"), `${record()}\n`);
    const d = defaultDeps(repoRoot, {
      evidenceRoot,
      env,
      now: () => Date.parse("2026-08-19T00:00:00.000Z"),
      log: () => undefined,
      tenantId: "example",
    });
    const dry = await digestSend(d, { dryRun: true, to: "owner@example.com" });
    expect(dry.ok).toBe(true);
    if (dry.ok) {
      expect(dry.dryRun).toBe(true);
      expect(dry.to).toBe("owner@example.com");
      expect(dry.digest.runs.total).toBe(1);
    }
    expect(renderDigestResult(dry)).toContain("dry run");

    const sent = await digestSend(d, {
      send: async (input) => {
        expect(input.to).toBe("ops@example.com");
        expect(input.html).toContain("#0b1612");
        expect(input.text).toContain("1 runs");
        expect(input.html).not.toContain("am_test");
        expect(input.text).not.toContain("am_test");
        return { ok: true, messageId: "m1", threadId: "t1" };
      },
    });
    expect(sent).toMatchObject({ ok: true, dryRun: false, messageId: "m1" });
    expect(renderDigestResult(sent)).toContain("mailed");

    const failed = await digestSend(d, {
      send: async () => ({ ok: false, detail: "AgentMail HTTP 403" }),
    });
    expect(failed).toMatchObject({ ok: false, skipped: "send-failed" });
    expect(renderDigestResult(failed)).toContain("403");

    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message_id: "m2", thread_id: "t2" }), { status: 200 })) as typeof fetch;
    try {
      const viaDefault = await digestSend(d);
      expect(viaDefault).toMatchObject({ ok: true, messageId: "m2" });
    } finally {
      globalThis.fetch = original;
    }
  });
});
