import { NextRequest, NextResponse } from "next/server";

import { computeStats } from "@/lib/data/analytics";
import { buildCachedDashboardSnapshot, buildDashboardSnapshot } from "@/lib/data/engine";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import type { DashboardSnapshot, Observation, PanelSnapshot, SeriesResult, WindowKey } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CachedObservation = Observation & { sourceRetrievedAt?: string | null; sourceUrl?: string | null };

function metricLooksTruncated(metric: SeriesResult) {
  const latestDate = metric.stats.latestDate;
  if (!latestDate) return false;
  const timestamp = new Date(latestDate).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = Date.now() - timestamp;
  if (timestamp < Date.UTC(1995, 0, 1)) return true;
  if (metric.config.marketSymbol && ageMs > 14 * 24 * 60 * 60 * 1000) return true;
  if (metric.config.sourceId === "fred" && ageMs > 730 * 24 * 60 * 60 * 1000) return true;
  return false;
}

function collectPanelMetrics(panel: PanelSnapshot): SeriesResult[] {
  return [...panel.metrics, ...panel.children.flatMap(collectPanelMetrics)];
}

function collectPanels(panel: PanelSnapshot): PanelSnapshot[] {
  return [panel, ...panel.children.flatMap(collectPanels)];
}

function collectMetrics(snapshot: DashboardSnapshot) {
  return [...snapshot.topMetrics, ...snapshot.panels.flatMap(collectPanelMetrics)];
}

function cacheLooksTruncated(snapshot: DashboardSnapshot) {
  return collectMetrics(snapshot).some(metricLooksTruncated);
}

function weightedStress(metrics: SeriesResult[]) {
  let numerator = 0;
  let denominator = 0;
  for (const metric of metrics) {
    if (metric.stats.zScore === undefined || metric.confidence === "unavailable") continue;
    const weight = metric.config.importance;
    const polarity = metric.config.polarity;
    let z = metric.stats.zScore;
    if (polarity === "higher_is_easier") z = -z;
    if (polarity === "neutral") z = Math.abs(z) * 0.25;
    numerator += z * weight;
    denominator += weight;
  }
  return denominator ? numerator / denominator : 0;
}

function regimeForPanel(panel: PanelSnapshot) {
  if (panel.metrics.length === 0) return panel.news.length ? "news-driven" : "framework";
  const stress = weightedStress(panel.metrics);
  const hotCount = panel.metrics.filter((metric) =>
    metric.stats.regime?.includes("hot") || metric.stats.regime?.includes("stress") || metric.stats.regime?.includes("tight")
  ).length;
  const coolCount = panel.metrics.filter((metric) =>
    metric.stats.regime?.includes("cool") || metric.stats.regime?.includes("relief") || metric.stats.regime?.includes("easing")
  ).length;
  if (stress > 0.85) return "tightening / stress regime";
  if (stress < -0.85) return "easing / disinflationary regime";
  if (hotCount > coolCount + 1) return "above-trend / hot regime";
  if (coolCount > hotCount + 1) return "cooling / easing regime";
  return "mixed / transition regime";
}

function changeLine(metric: SeriesResult, key: WindowKey) {
  const value =
    key === "24h" ? metric.stats.oneDayChange :
    key === "7d" ? metric.stats.sevenDayChange :
    metric.stats.thirtyDayChange;
  if (value === undefined || metric.confidence === "unavailable") return null;
  const absolute = metric.config.transform === "rate" || metric.config.transform === "spread";
  const unit = absolute ? metric.config.unit : "percent";
  const sign = value > 0 ? "+" : "";
  return `${metric.config.label}: ${sign}${formatNumber(value, unit)} over ${key}`;
}

function whatChanged(metrics: SeriesResult[]) {
  return (["24h", "7d", "30d"] as const).reduce<Record<WindowKey, string[]>>((accumulator, key) => {
    accumulator[key] = metrics
      .map((metric) => changeLine(metric, key))
      .filter((line): line is string => Boolean(line))
      .slice(0, 4);
    return accumulator;
  }, { "24h": [], "7d": [], "30d": [] });
}

function conclusionForPanel(panel: PanelSnapshot) {
  const topMetric = panel.metrics
    .filter((metric) => metric.stats.latest !== undefined)
    .sort((a, b) => b.config.importance - a.config.importance)[0];
  const latestNews = [...panel.news]
    .sort((a, b) => new Date(b.publishedAt ?? b.retrievedAt).getTime() - new Date(a.publishedAt ?? a.retrievedAt).getTime())[0];
  if (!topMetric && latestNews) return `${panel.title}: latest source flow is led by ${latestNews.title}.`;
  if (!topMetric) return panel.summary;
  const change = topMetric.stats.thirtyDayChange ?? topMetric.stats.yoy ?? topMetric.stats.mom;
  const unit = topMetric.config.transform === "rate" || topMetric.config.transform === "spread" ? topMetric.config.unit : "percent";
  const changeText = change === undefined
    ? "freshness is available but change history is limited"
    : `${change >= 0 ? "+" : ""}${formatNumber(change, unit)} on the relevant lookback`;
  return `${panel.title}: ${topMetric.config.label} is ${formatNumber(topMetric.stats.latest, topMetric.config.unit)} as of ${topMetric.stats.latestDate}; ${changeText}.`;
}

function refreshPanelDerivedState(panel: PanelSnapshot): PanelSnapshot {
  panel.children = panel.children.map(refreshPanelDerivedState);
  panel.regime = regimeForPanel(panel);
  panel.whatChanged = whatChanged(panel.metrics);
  panel.conclusion = conclusionForPanel(panel);
  return panel;
}

function refreshSnapshotDerivedState(snapshot: DashboardSnapshot) {
  snapshot.panels = snapshot.panels.map(refreshPanelDerivedState);
  snapshot.topConclusions = snapshot.panels
    .flatMap(collectPanels)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5)
    .map((panel) => panel.conclusion);
  snapshot.globalRegime = snapshot.panels.some((panel) => panel.regime.includes("tight") || panel.regime.includes("stress"))
    ? "risk tightening dominates"
    : snapshot.panels.some((panel) => panel.regime.includes("easing"))
      ? "liquidity/easing impulse building"
      : "mixed transition";
  return snapshot;
}

async function readRecentObservations(seriesIds: string[]) {
  const supabase = getSupabaseAdmin();
  const grouped = new Map<string, CachedObservation[]>();
  if (!supabase || !seriesIds.length) return grouped;

  const uniqueSeriesIds = [...new Set(seriesIds)];
  const limit = Number(process.env.DASHBOARD_SERIES_HISTORY_LIMIT ?? 520);
  const concurrency = 6;

  for (let index = 0; index < uniqueSeriesIds.length; index += concurrency) {
    const slice = uniqueSeriesIds.slice(index, index + concurrency);
    await Promise.all(
      slice.map(async (seriesId) => {
        const { data, error } = await supabase
          .from("macro_observations")
          .select("observation_date,value,source_retrieved_at,source_url")
          .eq("series_id", seriesId)
          .order("observation_date", { ascending: false })
          .limit(limit);

        if (error) {
          console.error(`macro observation cache repair failed for ${seriesId}: ${error.message}`);
          return;
        }

        const observations: CachedObservation[] = (data ?? [])
          .map((row) => ({
            date: row.observation_date,
            value: Number(row.value),
            sourceRetrievedAt: row.source_retrieved_at,
            sourceUrl: row.source_url
          }))
          .filter((row) => Boolean(row.date) && Number.isFinite(row.value))
          .sort((a, b) => a.date.localeCompare(b.date));

        grouped.set(seriesId, observations);
      })
    );
  }

  return grouped;
}

async function repairSnapshotFromSupabase(snapshot: DashboardSnapshot) {
  const metricRefs = collectMetrics(snapshot);
  const observationsBySeries = await readRecentObservations(metricRefs.map((metric) => metric.config.id));

  for (const metric of metricRefs) {
    const observations = observationsBySeries.get(metric.config.id);
    if (!observations?.length) continue;

    const latestObservation = observations.at(-1);
    metric.observations = observations;
    metric.stats = computeStats(metric.config, observations);
    metric.confidence = observations.length >= 24 ? "high" : observations.length >= 2 ? "medium" : "low";
    metric.error = undefined;
    metric.citation = {
      ...metric.citation,
      sourceUrl: latestObservation?.sourceUrl ?? metric.citation.sourceUrl,
      retrievedAt: latestObservation?.sourceRetrievedAt ?? metric.citation.retrievedAt
    };
  }

  snapshot.topMetrics = snapshot.panels
    .flatMap(collectPanelMetrics)
    .filter((metric) => metric.stats.latest !== undefined)
    .sort((a, b) => b.config.importance - a.config.importance)
    .slice(0, 12);

  snapshot.errors = snapshot.panels
    .flatMap(collectPanelMetrics)
    .filter((metric) => metric.error)
    .map((metric) => `${metric.config.label}: ${metric.error}`);

  return refreshSnapshotDerivedState(snapshot);
}

export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get("tab");
  const cachedSnapshot = await buildCachedDashboardSnapshot(tab);
  const repairedSnapshot = cacheLooksTruncated(cachedSnapshot)
    ? await repairSnapshotFromSupabase(cachedSnapshot)
    : cachedSnapshot;
  const snapshot = cacheLooksTruncated(repairedSnapshot)
    ? await buildDashboardSnapshot(tab, { force: true })
    : repairedSnapshot;

  return NextResponse.json(refreshSnapshotDerivedState(snapshot), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
