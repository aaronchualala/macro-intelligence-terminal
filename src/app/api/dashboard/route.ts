import { NextRequest, NextResponse } from "next/server";

import { computeStats } from "@/lib/data/analytics";
import { buildCachedDashboardSnapshot, buildDashboardSnapshot } from "@/lib/data/engine";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import type { DashboardSnapshot, Observation, PanelSnapshot, SeriesResult } from "@/lib/types";

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

function collectMetrics(snapshot: DashboardSnapshot) {
  return [...snapshot.topMetrics, ...snapshot.panels.flatMap(collectPanelMetrics)];
}

function cacheLooksTruncated(snapshot: DashboardSnapshot) {
  return collectMetrics(snapshot).some(metricLooksTruncated);
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

        grouped.set(
          seriesId,
          (data ?? [])
            .map((row) => ({
              date: row.observation_date,
              value: Number(row.value),
              sourceRetrievedAt: row.source_retrieved_at,
              sourceUrl: row.source_url
            }))
            .filter((row): row is CachedObservation => Boolean(row.date) && Number.isFinite(row.value))
            .sort((a, b) => a.date.localeCompare(b.date))
        );
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

  return snapshot;
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

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
