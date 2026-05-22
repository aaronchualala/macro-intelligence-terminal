import { getSource, getTabConfig } from "@/lib/catalog";
import { parseCsv } from "@/lib/data/csv";
import { fetchWithCache, recordSourceHealth } from "@/lib/data/http";
import { fetchNewsFeed, fetchSeries } from "@/lib/data/providers";
import { persistCatalogDefinitions, persistNewsItems, persistObservations } from "@/lib/data/engine";
import type { Citation, Observation, PanelConfig, SeriesConfig, SeriesResult } from "@/lib/types";

type RefreshScope = "critical" | "all";

interface BatchRefreshOptions {
  panelIds?: string[];
  limitSeries?: number;
  offset?: number;
  includeNews?: boolean;
}

const RETIRED_FRED_SERIES = new Set(["NAPM", "NAPMNOI", "NAPMII", "NAPMPRI"]);

function numeric(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replaceAll(",", "").trim();
  if (!cleaned || cleaned === "." || cleaned.toLowerCase() === "nan") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compactObservations(observations: Observation[], max = Number(process.env.OBSERVATION_HISTORY_LIMIT ?? 520)) {
  if (observations.length <= max) return observations;
  return observations.slice(-max);
}

function fredGraphUrl(ids: string[]) {
  const start = process.env.FRED_OBSERVATION_START ?? "2000-01-01";
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ids.join(",")}&cosd=${start}`;
}

function sourceCitation(config: SeriesConfig, retrievedAt: string, sourceUrl: string, metadata: Record<string, unknown>): Citation {
  const source = getSource(config.sourceId);
  return {
    sourceId: config.sourceId,
    sourceName: source?.name ?? config.sourceId,
    sourceUrl,
    humanUrl: config.humanUrl,
    retrievedAt,
    metadata
  };
}

function selectedPanelSeries(panel: PanelConfig, scope: RefreshScope) {
  const sourceSeries = (panel.series ?? []).filter((series) => !RETIRED_FRED_SERIES.has(series.fredSeriesId ?? ""));
  if (scope === "all") return sourceSeries;
  const maxSeries = panel.tags.includes("correlation") ? 6 : 2;
  return [...sourceSeries].sort((a, b) => b.importance - a.importance).slice(0, maxSeries);
}

function flattenPanelConfigs(panels: PanelConfig[]): PanelConfig[] {
  return panels.flatMap((panel) => [panel, ...flattenPanelConfigs(panel.children ?? [])]);
}

async function fetchFredBatch(configs: SeriesConfig[], force = true): Promise<SeriesResult[]> {
  const fredConfigs = configs.filter((config) => config.fredSeriesId);
  if (!fredConfigs.length) return [];
  if (fredConfigs.length === 1 || process.env.FRED_API_KEY) {
    const results = await Promise.all(
      fredConfigs.map(async (config) => {
        const result = await fetchSeries(config, force);
        return {
          config,
          observations: result.observations,
          stats: {},
          citation: result.citation,
          confidence: result.observations.length ? "high" : "unavailable"
        } satisfies SeriesResult;
      })
    );
    return results;
  }

  const ids = fredConfigs.map((config) => config.fredSeriesId!);
  const url = fredGraphUrl(ids);
  const startedAt = performance.now();
  try {
    const result = await fetchWithCache<string>(url, {
      sourceId: "fred",
      cacheTtlSeconds: 3600,
      cacheKey: `fred-batch:${ids.join(",")}:${process.env.FRED_OBSERVATION_START ?? "2000-01-01"}`,
      force,
      asText: true,
      timeoutMs: force ? Number(process.env.FRED_BATCH_TIMEOUT_MS ?? 22000) : 7000
    });
    const rows = parseCsv(result.data);
    await recordSourceHealth("fred", true, startedAt, result.status);
    return fredConfigs.map((config) => {
      const id = config.fredSeriesId!;
      const observations = rows
        .map((row) => ({
          date: row.observation_date ?? row.DATE ?? row.date,
          value: numeric(row[id])
        }))
        .filter((row): row is Observation => Boolean(row.date) && row.value !== undefined);
      return {
        config,
        observations: compactObservations(observations),
        stats: {},
        citation: sourceCitation(config, result.retrievedAt, config.sourceUrl, {
          provider: "FRED",
          seriesId: id,
          batchSeriesIds: ids,
          batchUrl: url,
          fromCache: result.fromCache,
          stale: result.stale ?? false
        }),
        confidence: observations.length ? "high" : "unavailable"
      } satisfies SeriesResult;
    });
  } catch (error) {
    await recordSourceHealth("fred", false, startedAt, undefined, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function refreshTabDataBatch(tabId: string | null | undefined, scope: RefreshScope = "critical", options: BatchRefreshOptions = {}) {
  const tab = getTabConfig(tabId);
  await persistCatalogDefinitions();
  const panels = flattenPanelConfigs(tab.panels).filter((panel) =>
    options.panelIds?.length ? options.panelIds.includes(panel.id) : true
  );
  const allSeries = panels.flatMap((panel) => selectedPanelSeries(panel, scope));
  const uniqueSeries = [...new Map(allSeries.map((series) => [series.id, series])).values()]
    .sort((a, b) => b.importance - a.importance);
  const defaultLimit = Number(process.env.REFRESH_SERIES_LIMIT ?? (scope === "all" ? 12 : 8));
  const offset = Math.max(0, options.offset ?? 0);
  const series = uniqueSeries.slice(offset, offset + Math.max(1, options.limitSeries ?? defaultLimit));
  const errors: string[] = [];
  const seriesResults: SeriesResult[] = [];

  const fredConfigs = series.filter((config) => config.source === "fred");
  const otherConfigs = series.filter((config) => config.source !== "fred");

  if (fredConfigs.length) {
    try {
      seriesResults.push(...await fetchFredBatch(fredConfigs, true));
    } catch (error) {
      errors.push(`FRED batch: ${error instanceof Error ? error.message : String(error)}`);
      for (const config of fredConfigs) {
        try {
          const result = await fetchSeries(config, true);
          seriesResults.push({
            config,
            observations: result.observations,
            stats: {},
            citation: result.citation,
            confidence: result.observations.length ? "high" : "unavailable"
          });
        } catch (fallbackError) {
          errors.push(`${config.label}: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }
    }
  }

  for (const config of otherConfigs) {
    try {
      const result = await fetchSeries(config, true);
      seriesResults.push({
        config,
        observations: result.observations,
        stats: {},
        citation: result.citation,
        confidence: result.observations.length ? "high" : "unavailable"
      });
    } catch (error) {
      errors.push(`${config.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await persistObservations(seriesResults);

  let refreshedNews = 0;
  if (options.includeNews) {
    const feeds = [...new Map(panels.flatMap((panel) => panel.newsFeeds ?? []).map((item) => [item.id, item])).values()];
    for (const feed of feeds) {
      const items = await fetchNewsFeed(feed, true);
      refreshedNews += items.length;
      await persistNewsItems(items);
    }
  }

  return {
    tab: tab.id,
    scope,
    refreshedSeries: seriesResults.length,
    refreshedNews,
    errors
  };
}
