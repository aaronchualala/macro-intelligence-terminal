import { XMLParser } from "fast-xml-parser";

import { DATA_SOURCES, getSource } from "@/lib/catalog";
import { parseCsv } from "@/lib/data/csv";
import { fetchWithCache, recordSourceHealth } from "@/lib/data/http";
import type { Citation, NewsFeedConfig, NewsItem, Observation, SeriesConfig, SourceHealth } from "@/lib/types";
import { hashString } from "@/lib/utils";

const marketTtl = Number(process.env.MARKET_CACHE_TTL_SECONDS ?? 900);
const newsTtl = Number(process.env.NEWS_CACHE_TTL_SECONDS ?? 1800);

function sourceCitation(config: SeriesConfig, retrievedAt: string, metadata: Record<string, unknown> = {}): Citation {
  const source = getSource(config.sourceId);
  return {
    sourceId: config.sourceId,
    sourceName: source?.name ?? config.sourceId,
    sourceUrl: config.sourceUrl,
    humanUrl: config.humanUrl,
    retrievedAt,
    metadata
  };
}

function numeric(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replaceAll(",", "").trim();
  if (!cleaned || cleaned === "." || cleaned.toLowerCase() === "nan") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compactObservations(observations: Observation[], max = 900) {
  if (observations.length <= max) return observations;
  return observations.slice(-max);
}

export async function fetchFredSeries(config: SeriesConfig, force = false) {
  const startedAt = performance.now();
  const id = config.fredSeriesId;
  if (!id) throw new Error(`Missing FRED series id for ${config.id}`);
  const url = process.env.FRED_API_KEY
    ? `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${process.env.FRED_API_KEY}&file_type=json&observation_start=1950-01-01`
    : config.sourceUrl;
  try {
    const result = await fetchWithCache<string | { observations?: { date: string; value: string }[] }>(url, {
      sourceId: "fred",
      cacheTtlSeconds: 3600,
      force,
      asText: !process.env.FRED_API_KEY
    });
    const observations = typeof result.data === "string"
      ? parseCsv(result.data)
          .map((row) => ({ date: row.observation_date, value: numeric(row[id]) }))
          .filter((row): row is Observation => Boolean(row.date) && row.value !== undefined)
      : (result.data.observations ?? [])
          .map((row) => ({ date: row.date, value: numeric(row.value) }))
          .filter((row): row is Observation => Boolean(row.date) && row.value !== undefined);
    await recordSourceHealth("fred", true, startedAt, result.status);
    return {
      observations: compactObservations(observations),
      citation: sourceCitation(config, result.retrievedAt, {
        provider: "FRED",
        seriesId: id,
        fromCache: result.fromCache,
        stale: result.stale ?? false
      })
    };
  } catch (error) {
    await recordSourceHealth("fred", false, startedAt, undefined, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function fetchTreasurySeries(config: SeriesConfig, force = false) {
  const startedAt = performance.now();
  const spec = config.treasury;
  if (!spec) throw new Error(`Missing Treasury spec for ${config.id}`);
  const params = new URLSearchParams();
  params.set("fields", spec.fields.join(","));
  params.set("page[size]", String(spec.pageSize ?? 10000));
  if (spec.filter) params.set("filter", spec.filter);
  if (spec.sort) params.set("sort", spec.sort);
  const url = `${config.sourceUrl}?${params.toString()}`;
  try {
    const result = await fetchWithCache<{ data?: Record<string, string>[] }>(url, {
      sourceId: "treasury",
      cacheTtlSeconds: 3600,
      force
    });
    const observations = (result.data.data ?? [])
      .map((row) => ({
        date: row[spec.dateField],
        value: numeric(row[spec.valueField])
      }))
      .filter((row): row is Observation => Boolean(row.date) && row.value !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));
    await recordSourceHealth("treasury", true, startedAt, result.status);
    return {
      observations: compactObservations(observations),
      citation: sourceCitation(config, result.retrievedAt, {
        provider: "Treasury Fiscal Data",
        endpoint: spec.endpoint,
        valueField: spec.valueField,
        fromCache: result.fromCache,
        stale: result.stale ?? false
      })
    };
  } catch (error) {
    await recordSourceHealth("treasury", false, startedAt, undefined, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function fetchMarketSeries(config: SeriesConfig, force = false) {
  const startedAt = performance.now();
  const symbol = config.marketSymbol;
  if (!symbol) throw new Error(`Missing market symbol for ${config.id}`);
  const url = config.sourceUrl;
  try {
    const result = await fetchWithCache<{
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: Array<number | null> }[] };
        }[];
      };
    }>(url, {
      sourceId: "yahoo",
      cacheTtlSeconds: marketTtl,
      force
    });
    const chart = result.data.chart?.result?.[0];
    const timestamps = chart?.timestamp ?? [];
    const closes = chart?.indicators?.quote?.[0]?.close ?? [];
    const observations = timestamps
      .map((timestamp, index) => {
        const value = closes[index];
        return value === null || value === undefined
          ? undefined
          : { date: new Date(timestamp * 1000).toISOString().slice(0, 10), value };
      })
      .filter((row): row is Observation => Boolean(row))
      .sort((a, b) => a.date.localeCompare(b.date));
    await recordSourceHealth("yahoo", true, startedAt, result.status);
    return {
      observations: compactObservations(observations),
      citation: sourceCitation(config, result.retrievedAt, {
        provider: "Yahoo Finance chart endpoint",
        symbol,
        fromCache: result.fromCache,
        stale: result.stale ?? false
      })
    };
  } catch (error) {
    await recordSourceHealth("yahoo", false, startedAt, undefined, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function fetchAlphaVantageSeries(config: SeriesConfig, force = false) {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) {
    throw new Error("ALPHAVANTAGE_API_KEY is not configured; value is unavailable rather than estimated.");
  }
  const startedAt = performance.now();
  const spec = config.alphaVantage;
  if (!spec) throw new Error(`Missing Alpha Vantage spec for ${config.id}`);
  const params = new URLSearchParams({
    function: spec.functionName,
    symbol: spec.symbol,
    apikey: key
  });
  const url = `https://www.alphavantage.co/query?${params.toString()}`;
  try {
    const result = await fetchWithCache<Record<string, string>>(url, {
      sourceId: "alpha_vantage",
      cacheTtlSeconds: 24 * 3600,
      force
    });
    if (result.data.Note || result.data.Information) {
      throw new Error(result.data.Note ?? result.data.Information);
    }
    const value = spec.field ? numeric(result.data[spec.field]) : undefined;
    const observations = value === undefined ? [] : [{ date: new Date().toISOString().slice(0, 10), value }];
    await recordSourceHealth("alpha_vantage", true, startedAt, result.status);
    return {
      observations,
      citation: sourceCitation(config, result.retrievedAt, {
        provider: "Alpha Vantage",
        symbol: spec.symbol,
        field: spec.field,
        fromCache: result.fromCache,
        stale: result.stale ?? false
      })
    };
  } catch (error) {
    await recordSourceHealth("alpha_vantage", false, startedAt, undefined, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

function findCftcField(row: Record<string, string>, patterns: string[]) {
  const entry = Object.entries(row).find(([key]) => {
    const normalized = key.toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
    return patterns.every((pattern) => normalized.includes(pattern));
  });
  return entry?.[1];
}

export async function fetchCftcSeries(config: SeriesConfig, force = false) {
  const startedAt = performance.now();
  const spec = config.cftc;
  if (!spec) throw new Error(`Missing CFTC spec for ${config.id}`);
  try {
    const result = await fetchWithCache<string>("https://www.cftc.gov/dea/newcot/deafut.txt", {
      sourceId: "cftc",
      cacheTtlSeconds: 12 * 3600,
      force,
      asText: true
    });
    const rows = parseCsv(result.data);
    const match = rows.find((row) =>
      Object.values(row).some((value) => value.toUpperCase().includes(spec.marketName.toUpperCase()))
    );
    if (!match) throw new Error(`No CFTC row matched ${spec.marketName}`);
    const date =
      findCftcField(match, ["as of", "date"]) ??
      findCftcField(match, ["report", "date"]) ??
      new Date().toISOString().slice(0, 10);
    const longValue = numeric(findCftcField(match, ["noncommercial", "long", "all"]));
    const shortValue = numeric(findCftcField(match, ["noncommercial", "short", "all"]));
    const oiValue = numeric(findCftcField(match, ["open interest", "all"]));
    const value = spec.value === "open_interest" ? oiValue : longValue !== undefined && shortValue !== undefined ? longValue - shortValue : undefined;
    if (value === undefined) throw new Error(`CFTC row found for ${spec.marketName}, but value fields were unavailable.`);
    await recordSourceHealth("cftc", true, startedAt, result.status);
    return {
      observations: [{ date: new Date(date).toISOString().slice(0, 10), value }],
      citation: sourceCitation(config, result.retrievedAt, {
        provider: "CFTC Commitments of Traders",
        marketName: spec.marketName,
        value: spec.value,
        fromCache: result.fromCache,
        stale: result.stale ?? false
      })
    };
  } catch (error) {
    await recordSourceHealth("cftc", false, startedAt, undefined, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function fetchSeries(config: SeriesConfig, force = false) {
  if (config.source === "fred") return fetchFredSeries(config, force);
  if (config.source === "treasury") return fetchTreasurySeries(config, force);
  if (config.source === "market") return fetchMarketSeries(config, force);
  if (config.source === "alpha_vantage") return fetchAlphaVantageSeries(config, force);
  if (config.source === "cftc") return fetchCftcSeries(config, force);
  throw new Error(`Unsupported source kind ${config.source}`);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text"
});

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in value) return String((value as { text?: unknown }).text ?? "");
  return undefined;
}

export async function fetchNewsFeed(feed: NewsFeedConfig, force = false): Promise<NewsItem[]> {
  const startedAt = performance.now();
  const source = getSource(feed.sourceId);
  try {
    const result = await fetchWithCache<string>(feed.url, {
      sourceId: feed.sourceId,
      cacheTtlSeconds: newsTtl,
      force,
      asText: true
    });
    const xml = parser.parse(result.data);
    const rssItems = normalizeArray(xml.rss?.channel?.item);
    const atomItems = normalizeArray(xml.feed?.entry);
    const items = [...rssItems, ...atomItems].slice(0, 15).map((item, index) => {
      const title = textValue(item.title) ?? "Untitled release";
      const atomLink = Array.isArray(item.link)
        ? item.link.find((link: { href?: string }) => link.href)?.href
        : item.link?.href;
      const url = textValue(item.link) ?? atomLink ?? textValue(item.id) ?? feed.url;
      const publishedAt = textValue(item.pubDate) ?? textValue(item.published) ?? textValue(item.updated);
      return {
        id: hashString(`${feed.id}:${url}:${index}`),
        title,
        url,
        sourceId: feed.sourceId,
        sourceName: source?.name ?? feed.sourceId,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
        retrievedAt: result.retrievedAt,
        summary: textValue(item.description) ?? textValue(item.summary),
        tags: feed.tags
      };
    });
    await recordSourceHealth(feed.sourceId, true, startedAt, result.status);
    return items;
  } catch (error) {
    await recordSourceHealth(feed.sourceId, false, startedAt, undefined, error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function checkAllSources(): Promise<SourceHealth[]> {
  const checks = await Promise.all(
    DATA_SOURCES.filter((source) => source.kind !== "manual_methodology").map(async (source) => {
      const startedAt = performance.now();
      const probe = source.kind === "fred"
        ? "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10"
        : source.kind === "treasury"
          ? `${source.baseUrl}/v1/accounting/od/auctions_query?page[size]=1`
          : source.kind === "market"
            ? "https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=5d&interval=1d"
            : source.kind === "cftc"
              ? "https://www.cftc.gov/dea/newcot/deafut.txt"
              : `${source.baseUrl}`;
      try {
        const response = await fetch(probe, {
          method: "GET",
          headers: { "User-Agent": "MacroIntelligenceDashboard/0.1" },
          cache: "no-store"
        });
        const ok = response.ok;
        await recordSourceHealth(source.id, ok, startedAt, response.status, ok ? undefined : `HTTP ${response.status}`);
        return {
          sourceId: source.id,
          ok,
          checkedAt: new Date().toISOString(),
          latencyMs: Math.round(performance.now() - startedAt),
          status: response.status,
          error: ok ? undefined : `HTTP ${response.status}`
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordSourceHealth(source.id, false, startedAt, undefined, message);
        return {
          sourceId: source.id,
          ok: false,
          checkedAt: new Date().toISOString(),
          latencyMs: Math.round(performance.now() - startedAt),
          error: message
        };
      }
    })
  );
  return checks;
}
