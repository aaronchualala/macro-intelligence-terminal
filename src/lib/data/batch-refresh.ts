import { getSource, getTabConfig } from "@/lib/catalog";
import { parseCsv } from "@/lib/data/csv";
import { recordSourceHealth } from "@/lib/data/http";
import { fetchNewsFeed, fetchSeries } from "@/lib/data/providers";
import { persistCatalogDefinitions, persistNewsItems, persistObservations } from "@/lib/data/engine";
import type { Citation, Observation, PanelConfig, SeriesConfig, SeriesResult } from "@/lib/types";

type RefreshScope = "critical" | "all";

interface BatchRefreshOptions {
  panelIds?: string[];
  limitSeries?: number;
  offset?: number;
  includeNews?: boolean;
  includeCatalog?: boolean;
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

function compactObservations(observations: Observation[], max = Number(process.env.OBSERVATION_HISTORY_LIMIT ?? 120)) {
  if (observations.length <= max) return observations;
  return observations.slice(-max);
}

async function fetchText(url: string, timeoutMs = Number(process.env.FRED_BATCH_TIMEOUT_MS ?? 14000)) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timed out after ${timeoutMs}ms fetching ${url}`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "MacroIntelligenceDashboard/0.1 contact=personal-dashboard",
            Accept: "text/csv,text/plain,*/*"
          },
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
        return {
          text: await response.text(),
          status: response.status,
          retrievedAt: new Date().toISOString()
        };
      })(),
      timeoutPromise
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchJson<T>(url: string, timeoutMs = Number(process.env.FRED_API_TIMEOUT_MS ?? 12000)) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timed out after ${timeoutMs}ms fetching FRED API`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "MacroIntelligenceDashboard/0.1 contact=personal-dashboard",
            Accept: "application/json"
          },
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`FRED API HTTP ${response.status}`);
        return {
          data: await response.json() as T,
          status: response.status,
          retrievedAt: new Date().toISOString()
        };
      })(),
      timeoutPromise
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function fredGraphUrl(ids: string[]) {
  const start = process.env.FRED_OBSERVATION_START ?? "2022-01-01";
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ids.join(",")}&cosd=${start}`;
}

function fredApiUrl(id: string, apiKey: string) {
  const params = new URLSearchParams({
    series_id: id,
    api_key: apiKey,
    file_type: "json",
    observation_start: process.env.FRED_OBSERVATION_START ?? "2022-01-01"
  });
  return `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`;
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

async function fetchFredApiSeries(config: SeriesConfig, force = true): Promise<SeriesResult> {
  const apiKey = process.env.FRED_API_KEY;
  const id = config.fredSeriesId;
  if (!apiKey || !id) throw new Error(`Missing FRED API setup for ${config.id}`);
  const startedAt = performance.now();
  try {
    const result = await fetchJson<{ observations?: { date: string; value: string }[] }>(
      fredApiUrl(id, apiKey),
      force ? Number(process.env.FRED_API_TIMEOUT_MS ?? 12000) : 7000
    );
    const observations = (result.data.observations ?? [])
      .map((row) => ({ date: row.date, value: numeric(row.value) }))
      .filter((row): row is Observation => Boolean(row.date) && row.value !== undefined);
    await recordSourceHealth("fred", true, startedAt, result.status);
    return {
      config,
      observations: compactObservations(observations),
      stats: {},
      citation: sourceCitation(config, result.retrievedAt, config.sourceUrl, {
        provider: "FRED API",
        seriesId: id,
        endpoint: "https://api.stlouisfed.org/fred/series/observations",
        fromCache: false,
        stale: false
      }),
      confidence: observations.length ? "high" : "unavailable"
    };
  } catch (error) {
    await recordSourceHealth("fred", false, startedAt, undefined, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function fetchFredBatch(configs: SeriesConfig[], force = true): Promise<SeriesResult[]> {
  const fredConfigs = configs.filter((config) => config.fredSeriesId);
  if (!fredConfigs.length) return [];
  if (process.env.FRED_API_KEY) {
    return Promise.all(fredConfigs.map((config) => fetchFredApiSeries(config, force)));
  }

  const ids = fredConfigs.map((config) => config.fredSeriesId!);
  const url = fredGraphUrl(ids);
  const startedAt = performance.now();
  try {
    const result = await fetchText(url, force ? Number(process.env.FRED_BATCH_TIMEOUT_MS ?? 14000) : 7000);
    const rows = parseCsv(result.text);
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
          fromCache: false,
          stale: false
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
  if (options.includeCatalog) {
    await persistCatalogDefinitions();
  }
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
      if (process.env.FRED_API_KEY || process.env.FRED_ALLOW_SERIES_FALLBACK === "1") {
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
