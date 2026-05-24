import { DATA_SOURCES, getSource, getTabConfig, TABS } from "@/lib/catalog";
import { computeStats, latestCorrelationSummary } from "@/lib/data/analytics";
import { fetchNewsFeed, fetchSeries } from "@/lib/data/providers";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import type {
  Citation,
  Confidence,
  DashboardSnapshot,
  NewsItem,
  Observation,
  PanelConfig,
  PanelSnapshot,
  SeriesConfig,
  SeriesResult,
  SourceHealth,
  TabId,
  WindowKey
} from "@/lib/types";
import { formatMetricNumber, formatNumber } from "@/lib/utils";

interface BuildOptions {
  force?: boolean;
  tab?: TabId;
}

type RefreshScope = "critical" | "all";

const RETIRED_FRED_SERIES = new Set(["NAPM", "NAPMNOI", "NAPMII", "NAPMPRI"]);

interface RefreshOptions {
  panelIds?: string[];
  limitSeries?: number;
  offset?: number;
  includeNews?: boolean;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function next() {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current]);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function withTimeout<T>(label: string, work: PromiseLike<T>, timeoutMs = 8000): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => {
          console.error(`${label} timed out after ${timeoutMs}ms`);
          resolve(null);
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function fallbackCitation(config: SeriesConfig, error: string): Citation {
  const source = getSource(config.sourceId);
  return {
    sourceId: config.sourceId,
    sourceName: source?.name ?? config.sourceId,
    sourceUrl: config.sourceUrl,
    humanUrl: config.humanUrl,
    retrievedAt: new Date().toISOString(),
    metadata: { error }
  };
}

function confidenceFor(results: SeriesResult[], news: NewsItem[]): Confidence {
  const available = results.filter((item) => item.confidence !== "unavailable").length;
  const total = results.length;
  if (total === 0 && news.length > 0) return "medium";
  if (total === 0) return "low";
  const ratio = available / total;
  if (ratio >= 0.85) return "high";
  if (ratio >= 0.5) return "medium";
  if (ratio > 0) return "low";
  return "unavailable";
}

function changeLine(metric: SeriesResult, key: WindowKey) {
  const value =
    key === "24h"
      ? metric.stats.oneDayChange
      : key === "7d"
        ? metric.stats.sevenDayChange
        : metric.stats.thirtyDayChange;
  if (value === undefined) return undefined;
  const absolute = metric.config.transform === "rate" || metric.config.transform === "spread";
  const unit = absolute ? metric.config.unit : "percent";
  const sign = value > 0 ? "+" : "";
  return `${metric.config.label}: ${sign}${formatNumber(value, unit, absolute ? 2 : 2)} over ${key}`;
}

function whatChanged(metrics: SeriesResult[]): Record<WindowKey, string[]> {
  const windows: WindowKey[] = ["24h", "7d", "30d"];
  return Object.fromEntries(
    windows.map((windowKey) => [
      windowKey,
      metrics
        .map((metric) => ({
          metric,
          line: changeLine(metric, windowKey),
          magnitude: Math.abs(
            windowKey === "24h"
              ? metric.stats.oneDayChange ?? 0
              : windowKey === "7d"
                ? metric.stats.sevenDayChange ?? 0
                : metric.stats.thirtyDayChange ?? 0
          )
        }))
        .filter((item) => item.line && item.magnitude > 0)
        .sort((a, b) => b.magnitude * b.metric.config.importance - a.magnitude * a.metric.config.importance)
        .slice(0, 4)
        .map((item) => item.line!)
    ])
  ) as Record<WindowKey, string[]>;
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

function regimeFor(panel: PanelConfig, metrics: SeriesResult[]) {
  if (metrics.length === 0) return panel.newsFeeds?.length ? "news-driven" : "framework";
  const stress = weightedStress(metrics);
  const hotCount = metrics.filter((metric) => metric.stats.regime?.includes("hot") || metric.stats.regime?.includes("stress") || metric.stats.regime?.includes("tight")).length;
  const coolCount = metrics.filter((metric) => metric.stats.regime?.includes("cool") || metric.stats.regime?.includes("relief") || metric.stats.regime?.includes("easing")).length;
  if (stress > 0.85) return "tightening / stress regime";
  if (stress < -0.85) return "easing / disinflationary regime";
  if (hotCount > coolCount + 1) return "above-trend / hot regime";
  if (coolCount > hotCount + 1) return "cooling / easing regime";
  return "mixed / transition regime";
}

function conclusionFor(panel: PanelConfig, metrics: SeriesResult[], news: NewsItem[]) {
  const topMetric = metrics
    .filter((metric) => metric.stats.latest !== undefined)
    .sort((a, b) => b.config.importance - a.config.importance)[0];
  const latestNews = news.sort((a, b) => new Date(b.publishedAt ?? b.retrievedAt).getTime() - new Date(a.publishedAt ?? a.retrievedAt).getTime())[0];
  if (!topMetric && latestNews) return `${panel.title}: latest source flow is led by “${latestNews.title}”.`;
  if (!topMetric) return panel.summary;
  const change = topMetric.stats.thirtyDayChange ?? topMetric.stats.yoy ?? topMetric.stats.mom;
  const changeText = change === undefined
    ? "freshness is available but change history is limited"
    : `${change >= 0 ? "+" : ""}${formatNumber(change, topMetric.config.transform === "rate" || topMetric.config.transform === "spread" ? topMetric.config.unit : "percent")} on the relevant lookback`;
  return `${panel.title}: ${topMetric.config.label} is ${formatMetricNumber(topMetric)} as of ${topMetric.stats.latestDate}; ${changeText}.`;
}

async function resolveSeries(config: NonNullable<PanelConfig["series"]>[number], force = false): Promise<SeriesResult> {
  try {
    const result = await fetchSeries(config, force);
    const stats = computeStats(config, result.observations);
    return {
      config,
      observations: result.observations,
      stats,
      citation: result.citation,
      confidence: result.observations.length >= 24 ? "high" : result.observations.length >= 2 ? "medium" : result.observations.length === 1 ? "low" : "unavailable"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      config,
      observations: [],
      stats: { direction: "unavailable", regime: "unavailable" },
      citation: fallbackCitation(config, message),
      confidence: "unavailable",
      error: message
    };
  }
}

async function resolvePanel(panel: PanelConfig, force = false): Promise<PanelSnapshot> {
  const maxSeries = panel.tags.includes("correlation") ? 5 : 2;
  const seriesForInitialSnapshot = [...(panel.series ?? [])]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, maxSeries);
  const feedsForInitialSnapshot = [...(panel.newsFeeds ?? [])]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, panel.importance >= 70 ? 1 : 0);
  const [metrics, newsGroups, children] = await Promise.all([
    mapLimit(seriesForInitialSnapshot, 4, (series) => resolveSeries(series, force)),
    mapLimit(feedsForInitialSnapshot, 2, (newsFeed) => fetchNewsFeed(newsFeed, force)),
    mapLimit((panel.children ?? []).slice(0, 1), 2, (child) => resolvePanel(child, force))
  ]);
  const news = newsGroups
    .flat()
    .sort((a, b) => new Date(b.publishedAt ?? b.retrievedAt).getTime() - new Date(a.publishedAt ?? a.retrievedAt).getTime())
    .slice(0, 8);
  const citations = [
    ...metrics.map((metric) => metric.citation),
    ...news.map((item) => ({
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceUrl: item.url,
      humanUrl: item.url,
      retrievedAt: item.retrievedAt,
      publishedAt: item.publishedAt,
      title: item.title
    }))
  ];
  const analytics = metrics.length > 2
    ? {
        correlations: latestCorrelationSummary(
          metrics
            .filter((metric) => metric.observations.length > 80)
            .slice(0, 8)
            .map((metric) => ({
              label: metric.config.label,
              observations: metric.observations,
              transform: metric.config.transform
            }))
        ).slice(0, 12)
      }
    : undefined;
  return {
    id: panel.id,
    title: panel.title,
    summary: panel.summary,
    description: panel.description,
    importance: panel.importance,
    timeHorizon: panel.timeHorizon,
    tags: panel.tags,
    regime: regimeFor(panel, metrics),
    conclusion: conclusionFor(panel, metrics, news),
    whatChanged: whatChanged(metrics),
    confidence: confidenceFor(metrics, news),
    retrievedAt: new Date().toISOString(),
    metrics: metrics.sort((a, b) => b.config.importance - a.config.importance),
    news,
    scenarios: panel.scenarios ?? [],
    actors: panel.actors ?? [],
    catalysts: panel.catalysts ?? [],
    methodology: panel.methodology,
    citations,
    analytics,
    children
  };
}

function selectedPanelSeries(panel: PanelConfig, scope: RefreshScope | "ui" = "ui") {
  const sourceSeries = (panel.series ?? []).filter((series) => !RETIRED_FRED_SERIES.has(series.fredSeriesId ?? ""));
  if (scope === "all") return sourceSeries;
  const maxSeries = panel.tags.includes("correlation") ? 6 : 2;
  return [...sourceSeries].sort((a, b) => b.importance - a.importance).slice(0, maxSeries);
}

function flattenPanelConfigs(panels: PanelConfig[]): PanelConfig[] {
  return panels.flatMap((panel) => [panel, ...flattenPanelConfigs(panel.children ?? [])]);
}

async function cachedObservations(seriesIds: string[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !seriesIds.length) return new Map<string, Observation[]>();
  const grouped = new Map<string, Observation[]>();
  const uniqueSeriesIds = [...new Set(seriesIds)];
  await mapLimit(uniqueSeriesIds, 6, async (seriesId) => {
    const result = await withTimeout(
      `macro observation cache read for ${seriesId}`,
      supabase
        .from("macro_observations")
        .select("series_id,observation_date,value,source_retrieved_at,source_url,metadata")
        .eq("series_id", seriesId)
        .order("observation_date", { ascending: false })
        .limit(Number(process.env.DASHBOARD_SERIES_HISTORY_LIMIT ?? 520))
    );
    if (!result) return;
    const { data, error } = result;
    if (error) {
      console.error(`macro observation cache read failed for ${seriesId}: ${error.message}`);
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
        }) as Observation & { sourceRetrievedAt?: string; sourceUrl?: string })
        .sort((a, b) => a.date.localeCompare(b.date))
    );
  });
  return grouped;
}

async function cachedNews(panel: PanelConfig): Promise<NewsItem[]> {
  const supabase = getSupabaseAdmin();
  const sourceIds = [...new Set((panel.newsFeeds ?? []).map((feed) => feed.sourceId))];
  if (!supabase || !sourceIds.length) return [];
  const result = await withTimeout(
    "news cache read",
    supabase
      .from("news_items")
      .select("*")
      .in("source_id", sourceIds)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(8)
  );
  if (!result) return [];
  const { data, error } = result;
  if (error) {
    console.error(`news cache read failed: ${error.message}`);
    return [];
  }
  return (data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    sourceId: item.source_id,
    sourceName: getSource(item.source_id)?.name ?? item.source_id,
    publishedAt: item.published_at ?? undefined,
    retrievedAt: item.retrieved_at,
    summary: item.summary ?? undefined,
    tags: item.tags ?? []
  }));
}

function cachedSeriesResult(config: SeriesConfig, observations: Observation[]): SeriesResult {
  const source = getSource(config.sourceId);
  const stats = computeStats(config, observations);
  const latestObservation = observations.at(-1) as (Observation & { sourceRetrievedAt?: string; sourceUrl?: string }) | undefined;
  const retrievedAt = latestObservation?.sourceRetrievedAt ?? new Date().toISOString();
  return {
    config,
    observations,
    stats,
    citation: {
      sourceId: config.sourceId,
      sourceName: source?.name ?? config.sourceId,
      sourceUrl: latestObservation?.sourceUrl ?? config.sourceUrl,
      humanUrl: config.humanUrl,
      retrievedAt,
      metadata: {
        mode: "supabase-cache",
        seriesId: config.id
      }
    },
    confidence: observations.length >= 24 ? "high" : observations.length >= 2 ? "medium" : observations.length === 1 ? "low" : "unavailable",
    error: observations.length ? undefined : "No cached observations yet. Run this tab's ETL refresh."
  };
}

async function resolveCachedPanel(panel: PanelConfig, observationMap: Map<string, Observation[]>): Promise<PanelSnapshot> {
  const metrics = selectedPanelSeries(panel, "ui")
    .map((series) => cachedSeriesResult(series, observationMap.get(series.id) ?? []))
    .sort((a, b) => b.config.importance - a.config.importance);
  const [news, children] = await Promise.all([
    cachedNews(panel),
    mapLimit(panel.children ?? [], 5, (child) => resolveCachedPanel(child, observationMap))
  ]);
  const citations = [
    ...metrics.map((metric) => metric.citation),
    ...news.map((item) => ({
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceUrl: item.url,
      humanUrl: item.url,
      retrievedAt: item.retrievedAt,
      publishedAt: item.publishedAt,
      title: item.title
    }))
  ];
  const analytics = metrics.length > 2
    ? {
        correlations: latestCorrelationSummary(
          metrics
            .filter((metric) => metric.observations.length > 80)
            .slice(0, 8)
            .map((metric) => ({
              label: metric.config.label,
              observations: metric.observations,
              transform: metric.config.transform
            }))
        ).slice(0, 12)
      }
    : undefined;
  return {
    id: panel.id,
    title: panel.title,
    summary: panel.summary,
    description: panel.description,
    importance: panel.importance,
    timeHorizon: panel.timeHorizon,
    tags: panel.tags,
    regime: regimeFor(panel, metrics),
    conclusion: conclusionFor(panel, metrics, news),
    whatChanged: whatChanged(metrics),
    confidence: confidenceFor(metrics, news),
    retrievedAt: new Date().toISOString(),
    metrics,
    news,
    scenarios: panel.scenarios ?? [],
    actors: panel.actors ?? [],
    catalysts: panel.catalysts ?? [],
    methodology: panel.methodology,
    citations,
    analytics,
    children
  };
}

async function sourceHealthFromDb(): Promise<SourceHealth[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const result = await withTimeout(
    "source health read",
    supabase
      .from("source_health")
      .select("*")
      .order("checked_at", { ascending: false })
  );
  if (!result) return [];
  const { data, error } = result;
  if (error) {
    console.error(`source health read failed: ${error.message}`);
    return [];
  }
  return (data ?? []).map((item) => ({
    sourceId: item.source_id,
    ok: item.ok,
    checkedAt: item.checked_at,
    latencyMs: item.latency_ms ?? undefined,
    status: item.status ?? undefined,
    error: item.error ?? undefined
  }));
}

function topConclusions(panels: PanelSnapshot[]) {
  return panels
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5)
    .map((panel) => `${panel.title}: ${panel.regime}. ${panel.summary}`);
}

function globalRegime(panels: PanelSnapshot[]) {
  const stress = panels.filter((panel) => panel.regime.includes("stress") || panel.regime.includes("tight")).length;
  const easing = panels.filter((panel) => panel.regime.includes("easing") || panel.regime.includes("cool")).length;
  if (stress >= Math.max(2, easing + 2)) return "risk tightening dominates";
  if (easing >= Math.max(2, stress + 2)) return "easing/cooling dominates";
  return "mixed transition";
}

export async function buildDashboardSnapshot(tabId?: string | null, options: BuildOptions = {}): Promise<DashboardSnapshot> {
  const tab = getTabConfig(tabId);
  const panels = await mapLimit(tab.panels, 4, (panel) => resolvePanel(panel, options.force));
  const topMetrics = panels
    .flatMap((panel) => panel.metrics)
    .filter((metric) => metric.stats.latest !== undefined)
    .sort((a, b) => b.config.importance - a.config.importance)
    .slice(0, 12);
  const errors = panels
    .flatMap((panel) => panel.metrics)
    .filter((metric) => metric.error)
    .map((metric) => `${metric.config.label}: ${metric.error}`);
  return {
    tab: tab.id,
    label: tab.label,
    objective: tab.objective,
    regimeQuestion: tab.regimeQuestion,
    generatedAt: new Date().toISOString(),
    retrievedAt: new Date().toISOString(),
    globalRegime: globalRegime(panels),
    topConclusions: topConclusions(panels),
    topMetrics,
    panels: panels.sort((a, b) => b.importance - a.importance),
    sourceHealth: await sourceHealthFromDb(),
    errors
  };
}

export async function buildCachedDashboardSnapshot(tabId?: string | null): Promise<DashboardSnapshot> {
  const tab = getTabConfig(tabId);
  const seriesIds = flattenPanelConfigs(tab.panels).flatMap((panel) => selectedPanelSeries(panel, "ui").map((series) => series.id));
  const observationMap = await cachedObservations([...new Set(seriesIds)]);
  const panels = await mapLimit(tab.panels, 8, (panel) => resolveCachedPanel(panel, observationMap));
  const topMetrics = panels
    .flatMap((panel) => panel.metrics)
    .filter((metric) => metric.stats.latest !== undefined)
    .sort((a, b) => b.config.importance - a.config.importance)
    .slice(0, 12);
  const errors = panels
    .flatMap((panel) => panel.metrics)
    .filter((metric) => metric.error)
    .map((metric) => `${metric.config.label}: ${metric.error}`);
  return {
    tab: tab.id,
    label: tab.label,
    objective: tab.objective,
    regimeQuestion: tab.regimeQuestion,
    generatedAt: new Date().toISOString(),
    retrievedAt: new Date().toISOString(),
    globalRegime: globalRegime(panels),
    topConclusions: topConclusions(panels),
    topMetrics,
    panels: panels.sort((a, b) => b.importance - a.importance),
    sourceHealth: await sourceHealthFromDb(),
    errors
  };
}

export async function persistCatalogDefinitions() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await persistDataSourceDefinitions(DATA_SOURCES.map((source) => source.id));
  const series = TABS.flatMap((tab) =>
    tab.panels.flatMap(function flatten(panel): NonNullable<PanelConfig["series"]> {
      return [...(panel.series ?? []), ...(panel.children ?? []).flatMap(flatten)];
    })
  );
  await persistSeriesDefinitions(series);
}

async function persistDataSourceDefinitions(sourceIds: string[]) {
  const supabase = getSupabaseAdmin();
  const sourceIdSet = new Set(sourceIds);
  const sources = DATA_SOURCES.filter((source) => sourceIdSet.has(source.id));
  if (!supabase || !sources.length) return;
  const result = await withTimeout(
    "data source definition write",
    supabase.from("data_sources").upsert(
      sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.kind,
        base_url: source.baseUrl,
        human_url: source.humanUrl,
        cadence: source.cadence,
        requires_key: source.requiresKey ?? false,
        notes: source.notes ?? null,
        updated_at: new Date().toISOString()
      }))
    ),
    12000
  );
  if (!result) throw new Error("Failed to persist data source definitions: request timed out");
  const { error } = result;
  if (error) throw new Error(`Failed to persist data source definitions: ${error.message}`);
}

export async function persistSeriesDefinitions(configs: SeriesConfig[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !configs.length) return;
  const series = [...new Map(configs.map((config) => [config.id, config])).values()];
  await persistDataSourceDefinitions([...new Set(series.map((config) => config.sourceId))]);
  const result = await withTimeout(
    "macro series definition write",
    supabase.from("macro_series").upsert(
      series.map((config) => ({
        id: config.id,
        label: config.label,
        source_id: config.sourceId,
        source_series_id: config.fredSeriesId ?? config.marketSymbol ?? config.treasury?.valueField ?? config.alphaVantage?.symbol ?? config.cftc?.marketName ?? config.id,
        unit: config.unit,
        frequency: config.frequency,
        source_url: config.sourceUrl,
        human_url: config.humanUrl,
        description: config.description,
        tags: config.tags,
        importance: config.importance,
        updated_at: new Date().toISOString()
      }))
    ),
    12000
  );
  if (!result) throw new Error("Failed to persist series definitions: request timed out");
  const { error } = result;
  if (error) throw new Error(`Failed to persist series definitions: ${error.message}`);
}

export async function persistObservations(results: SeriesResult[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await persistSeriesDefinitions(results.map((result) => result.config));
  for (const result of results) {
    if (!result.observations.length) continue;
    const write = await withTimeout(
      `macro observations write for ${result.config.id}`,
      supabase.from("macro_observations").upsert(
        result.observations.map((observation: Observation) => ({
          series_id: result.config.id,
          observation_date: observation.date,
          value: observation.value,
          source_retrieved_at: result.citation.retrievedAt,
          source_url: result.citation.sourceUrl,
          metadata: result.citation.metadata ?? {}
        })),
        { onConflict: "series_id,observation_date" }
      ),
      15000
    );
    if (!write) throw new Error(`Failed to persist observations for ${result.config.id}: request timed out`);
    if (write.error) throw new Error(`Failed to persist observations for ${result.config.id}: ${write.error.message}`);
  }
}

export async function persistNewsItems(items: NewsItem[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !items.length) return;
  await supabase.from("news_items").upsert(
    items.map((item) => ({
      title: item.title,
      url: item.url,
      source_id: item.sourceId,
      feed_url: item.url,
      published_at: item.publishedAt ?? null,
      retrieved_at: item.retrievedAt,
      summary: item.summary ?? null,
      tags: item.tags,
      metadata: {}
    })),
    { onConflict: "url" }
  );
}

export async function refreshTabData(tabId: string | null | undefined, scope: RefreshScope = "critical", options: RefreshOptions = {}) {
  const tab = getTabConfig(tabId);
  await persistCatalogDefinitions();
  const panels = flattenPanelConfigs(tab.panels).filter((panel) =>
    options.panelIds?.length ? options.panelIds.includes(panel.id) : true
  );
  const uniqueSeries = [...new Map(panels.flatMap((panel) => selectedPanelSeries(panel, scope)).map((item) => [item.id, item])).values()]
    .sort((a, b) => b.importance - a.importance);
  const defaultLimit = Number(process.env.REFRESH_SERIES_LIMIT ?? (scope === "all" ? 12 : 8));
  const offset = Math.max(0, options.offset ?? 0);
  const series = uniqueSeries.slice(offset, offset + Math.max(1, options.limitSeries ?? defaultLimit));
  const feeds = options.includeNews ? panels.flatMap((panel) => panel.newsFeeds ?? []) : [];
  const errors: string[] = [];
  const seriesResults: SeriesResult[] = [];

  const fetchedSeries = await mapLimit(series, 2, async (config) => {
    try {
      const result = await fetchSeries(config, true);
      return {
        config,
        observations: result.observations,
        stats: {},
        citation: result.citation,
        confidence: result.observations.length ? "high" : "unavailable"
      } satisfies SeriesResult;
    } catch (error) {
      errors.push(`${config.label}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });

  for (const result of fetchedSeries) {
    if (result) seriesResults.push(result);
  }
  await persistObservations(seriesResults);

  let refreshedNews = 0;
  for (const feed of [...new Map(feeds.map((item) => [item.id, item])).values()]) {
    const items = await fetchNewsFeed(feed, true);
    refreshedNews += items.length;
    await persistNewsItems(items);
  }

  return {
    tab: tab.id,
    scope,
    refreshedSeries: seriesResults.length,
    refreshedNews,
    errors
  };
}

export function configuredSources() {
  return DATA_SOURCES;
}
