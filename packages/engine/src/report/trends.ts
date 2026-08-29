/**
 * Metrics over time, and the discipline required not to invent a trend.
 *
 * A time series is the easiest place in this whole system to produce a confident lie. Two
 * points make a line; three make a story. So every rule here exists to stop that:
 *
 * - **A series never interpolates.** A run that did not measure LCP contributes a GAP, not
 *   an estimated value. Drawing through it would fabricate the one thing the reader is
 *   looking at.
 * - **A direction is refused below a minimum sample.** "Getting worse" from three runs is
 *   noise with a narrative, and a dashboard that says it will be believed.
 * - **A change smaller than the noise floor is `stable`, not a direction.** A 2% move in
 *   TTFB between two halves of a series is the internet, not a regression.
 * - **Gaps are counted and reported.** A series that is mostly unmeasured must say so, or a
 *   trend computed from four of forty runs reads as a trend over forty.
 */
import type { RunRecord } from "../history/records.js";
import { marketOf } from "../analysis/site.js";
import { unmeasured, measured, type Measured } from "./measured.js";

/** The metrics worth trending. Each is a number where lower is better. */
export type TrendMetric = "lcp" | "cls" | "ttfb" | "inp" | "confidence";

/** One reading, or an explicit gap at a point in time. */
export interface TrendPoint {
  at: string;
  runId: string;
  /** Null is a GAP. It is never interpolated and never treated as zero. */
  value: number | null;
}

export type TrendDirection = "improving" | "worsening" | "stable" | "insufficient-data";

export interface TrendSeries {
  target: string;
  marketId: string;
  metric: TrendMetric;
  /** Every run in order, gaps included, so a renderer can show them as gaps. */
  points: TrendPoint[];
  /** How many points carried a reading. */
  measuredPoints: number;
  /** Median of the first half, or unmeasured when there is not enough data. */
  earlier: Measured<number>;
  /** Median of the second half. */
  later: Measured<number>;
  direction: TrendDirection;
  /** Always populated, including on `stable` and `insufficient-data`. */
  reason: string;
}

/**
 * The fewest points from which a direction may be claimed.
 *
 * Six, so each half has three and a median in each half is not just the middle of two. Below
 * this the answer is `insufficient-data` — which is a real answer, and a more useful one than
 * a direction nobody should act on.
 */
export const MIN_POINTS_FOR_DIRECTION = 6;

/**
 * How much a metric must move before the move is called a direction.
 *
 * 10% of the earlier median. Network latency varies by more than a few percent between any
 * two runs for reasons that have nothing to do with the site — a threshold below the noise
 * would turn a dashboard into a source of false alarms, and a dashboard that cries wolf is
 * one nobody opens.
 */
export const NOISE_FLOOR = 0.1;

/**
 * The smallest ABSOLUTE change worth calling a direction, per metric.
 *
 * A relative floor alone is not enough, and this was found by reading real output rather than
 * by reasoning about it. Against a local fixture server TTFB is about 1ms, so a move from
 * 1.05ms to 0.9ms is 14% — comfortably past the 10% relative floor — and the dashboard
 * reported it as "improving". The absolute change is 0.15ms. Nobody has ever improved a page
 * by 0.15ms.
 *
 * So a direction now has to clear BOTH floors. The numbers are the smallest change a person
 * would act on: 10ms of latency, 0.01 of CLS (a tenth of the "good" budget), and 2 points of
 * confidence.
 */
export const ABSOLUTE_FLOOR: Record<TrendMetric, number> = {
  lcp: 10,
  ttfb: 10,
  inp: 10,
  cls: 0.01,
  confidence: 2,
};

const valueOf = (record: RunRecord, metric: TrendMetric): number | null => {
  if (metric === "confidence") return record.confidence.overall;
  return record.vitals[metric];
};

/**
 * The median of a NON-EMPTY list.
 *
 * Typed to return a number rather than `number | null`, and the emptiness guard lives at the
 * one call site instead: `describe` has already refused anything below
 * `MIN_POINTS_FOR_DIRECTION`, so both halves provably hold at least three readings. A
 * nullable return here bought an unreachable branch that coverage then reported as dead —
 * defensive code with no reachable failure is not defence, it is a claim that the guard above
 * it might not hold.
 */
const median = (values: [number, ...number[]]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);
  return Math.round(value * 1000) / 1000;
};

/**
 * Build one series.
 *
 * `ERROR` runs are excluded, for the reason they are excluded everywhere else: an ERROR means
 * farsyn could not read the page, and a trend that counted our instrumentation failures would
 * show a site getting worse when what got worse was our ability to look at it.
 */
export function buildSeries(records: RunRecord[], metric: TrendMetric): TrendSeries[] {
  const usable = records.filter((r) => r.verdict !== "ERROR");
  const groups = new Map<string, RunRecord[]>();
  for (const record of usable) {
    // A JSON tuple, not a delimited string. Two reasons, and the second is the one that bit.
    //
    // A separator has to be a character that cannot appear in either part, and there is no
    // good visible candidate: a space is legal in neither a URL nor a market id but reads as
    // though it might be, and the first version of this used a literal NUL byte — which worked
    // and made the whole file register as BINARY to grep, so searching it silently returned
    // nothing. A file nobody can grep is a file whose next bug takes longer to find, and that
    // cost was paid during the review of this very change.
    const key = JSON.stringify([record.target, marketOf(record.profileId)]);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const series: TrendSeries[] = [];
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [target = "", marketId = ""] = JSON.parse(key) as [string, string];
    const ordered = [...group].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const points: TrendPoint[] = ordered.map((r) => ({ at: r.startedAt, runId: r.runId, value: valueOf(r, metric) }));
    series.push({ target, marketId, metric, ...describe(points, metric) });
  }
  return series;
}

/**
 * The direction, and the arithmetic is deliberately dull.
 *
 * Halves-and-medians rather than a regression line: a median is unmoved by one pathological
 * run, and a least-squares slope over six points is a number with more precision than
 * meaning. The goal is to answer "is this drifting" without ever answering it from too little
 * data.
 */
function describe(points: TrendPoint[], metric: TrendMetric): Omit<TrendSeries, "target" | "marketId" | "metric"> {
  const readings = points.filter((p): p is TrendPoint & { value: number } => p.value !== null);
  const base = { points, measuredPoints: readings.length };

  if (readings.length < MIN_POINTS_FOR_DIRECTION) {
    const gaps = points.length - readings.length;
    return {
      ...base,
      earlier: unmeasured(`only ${readings.length} measured point(s)`),
      later: unmeasured(`only ${readings.length} measured point(s)`),
      direction: "insufficient-data",
      reason:
        `${readings.length} measured point(s) of ${points.length}${gaps > 0 ? ` (${gaps} gap(s))` : ""} — at least ${MIN_POINTS_FOR_DIRECTION} are needed before a direction means anything. "Getting worse" from three runs is noise with a narrative.`,
    };
  }

  // Split the READINGS, not the points, so a run of gaps in the middle cannot put every
  // reading in one half and leave the other empty.
  // `half >= 3` because the guard above refused anything below MIN_POINTS_FOR_DIRECTION, so
  // both slices are non-empty and `median` needs no null case.
  const half = Math.floor(readings.length / 2);
  const earlierMedian = median(readings.slice(0, half).map((p) => p.value) as [number, ...number[]]);
  const laterMedian = median(readings.slice(readings.length - half).map((p) => p.value) as [number, ...number[]]);

  const delta = laterMedian - earlierMedian;
  // BOTH floors, and each catches what the other misses. The relative one scales with the
  // metric, so 10% of a 40ms TTFB and 10% of a 2000ms TTFB differ as they should. The absolute
  // one stops a percentage firing on a value too small to matter — a 14% move on a 1ms local
  // TTFB is 0.15ms, and the dashboard called that "improving" until this existed.
  const relativeFloor = Math.abs(earlierMedian) * NOISE_FLOOR;
  const absoluteFloor = ABSOLUTE_FLOOR[metric];
  const gaps = points.length - readings.length;
  const gapNote = gaps > 0 ? ` ${gaps} of ${points.length} run(s) did not measure it, so the trend describes the ${readings.length} that did.` : "";

  if (Math.abs(delta) <= relativeFloor || Math.abs(delta) < absoluteFloor) {
    const why =
      Math.abs(delta) <= relativeFloor
        ? `within the ${Math.round(NOISE_FLOOR * 100)}% noise floor`
        : `a change of ${Math.round(Math.abs(delta) * 1000) / 1000} is below the ${absoluteFloor} nobody would act on`;
    return {
      ...base,
      earlier: measured(earlierMedian, String(earlierMedian)),
      later: measured(laterMedian, String(laterMedian)),
      direction: "stable",
      reason: `${earlierMedian} → ${laterMedian}, ${why} — not called a direction.${gapNote}`,
    };
  }
  return {
    ...base,
    earlier: measured(earlierMedian, String(earlierMedian)),
    later: measured(laterMedian, String(laterMedian)),
    // Every metric here is one where LOWER is better, including confidence — which is why
    // confidence is inverted below rather than sharing the comparison.
    direction: delta > 0 ? "worsening" : "improving",
    reason: `${earlierMedian} → ${laterMedian} across ${readings.length} measured run(s).${gapNote}`,
  };
}

/**
 * Series worth showing first: a real direction, worsening before improving.
 *
 * `insufficient-data` and `stable` are filtered out of the headline rather than sorted to the
 * bottom. A dashboard that leads with forty rows of "not enough data" trains its reader to
 * scroll past the four that matter.
 */
export function notableTrends(series: TrendSeries[]): TrendSeries[] {
  const rank = { worsening: 0, improving: 1, stable: 2, "insufficient-data": 3 } as const;
  return series
    .filter((s) => s.direction === "worsening" || s.direction === "improving")
    .sort((a, b) => rank[a.direction] - rank[b.direction]);
}

/**
 * Confidence trends, where the comparison is INVERTED.
 *
 * Every other metric here is one where lower is better; confidence is the opposite, and
 * sharing the comparison would report a site whose readings became more trustworthy as
 * "worsening". Kept as its own function rather than a flag on `buildSeries`, because a
 * boolean argument at a call site is exactly how that inversion gets forgotten.
 */
export function buildConfidenceSeries(records: RunRecord[]): TrendSeries[] {
  return buildSeries(records, "confidence").map((s) =>
    s.direction === "worsening"
      ? { ...s, direction: "improving" as const }
      : s.direction === "improving"
        ? { ...s, direction: "worsening" as const }
        : s,
  );
}
