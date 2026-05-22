export type TabId =
  | "structural"
  | "economic"
  | "fiscal"
  | "monetary"
  | "corporate"
  | "positioning"
  | "correlation";

export type SourceKind =
  | "fred"
  | "treasury"
  | "rss"
  | "market"
  | "cftc"
  | "alpha_vantage"
  | "finnhub"
  | "sec"
  | "manual_methodology";

export type SeriesTransform =
  | "level"
  | "rate"
  | "price"
  | "spread"
  | "index"
  | "flow"
  | "balance_sheet";

export type Confidence = "high" | "medium" | "low" | "unavailable";

export type WindowKey = "24h" | "7d" | "30d";

export interface SourceDefinition {
  id: string;
  name: string;
  kind: SourceKind;
  baseUrl: string;
  humanUrl: string;
  cadence: string;
  requiresKey?: boolean;
  notes?: string;
}

export interface Citation {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  humanUrl: string;
  retrievedAt: string;
  publishedAt?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface Observation {
  date: string;
  value: number;
}

export interface SeriesConfig {
  id: string;
  label: string;
  source: SourceKind;
  sourceId: string;
  unit: string;
  transform: SeriesTransform;
  frequency: string;
  sourceUrl: string;
  humanUrl: string;
  description: string;
  importance: number;
  tags: string[];
  fredSeriesId?: string;
  marketSymbol?: string;
  treasury?: {
    endpoint: string;
    dateField: string;
    valueField: string;
    fields: string[];
    filter?: string;
    sort?: string;
    pageSize?: number;
  };
  alphaVantage?: {
    functionName: "OVERVIEW" | "EARNINGS" | "TIME_SERIES_DAILY";
    symbol: string;
    field?: string;
  };
  cftc?: {
    marketName: string;
    value: "net_noncommercial" | "open_interest";
  };
  polarity?: "higher_is_hotter" | "higher_is_easier" | "higher_is_tighter" | "neutral";
}

export interface ScenarioConfig {
  id: string;
  label: string;
  probability: number;
  description: string;
  marketPath: string;
  triggers: string[];
  sourceIds: string[];
}

export interface NewsFeedConfig {
  id: string;
  sourceId: string;
  url: string;
  tags: string[];
  importance: number;
}

export interface PanelConfig {
  id: string;
  title: string;
  summary: string;
  description: string;
  importance: number;
  timeHorizon?: string;
  tags: string[];
  series?: SeriesConfig[];
  newsFeeds?: NewsFeedConfig[];
  scenarios?: ScenarioConfig[];
  actors?: string[];
  catalysts?: string[];
  methodology?: string;
  children?: PanelConfig[];
}

export interface TabConfig {
  id: TabId;
  label: string;
  objective: string;
  regimeQuestion: string;
  panels: PanelConfig[];
}

export interface SeriesStats {
  latest?: number;
  latestDate?: string;
  prior?: number;
  priorDate?: string;
  oneDayChange?: number;
  sevenDayChange?: number;
  thirtyDayChange?: number;
  mom?: number;
  yoy?: number;
  threeMonthAnnualized?: number;
  percentile?: number;
  zScore?: number;
  direction?: "up" | "down" | "flat" | "unavailable";
  regime?: string;
}

export interface SeriesResult {
  config: SeriesConfig;
  observations: Observation[];
  stats: SeriesStats;
  citation: Citation;
  confidence: Confidence;
  error?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  publishedAt?: string;
  retrievedAt: string;
  summary?: string;
  tags: string[];
}

export interface PanelSnapshot {
  id: string;
  title: string;
  summary: string;
  description: string;
  importance: number;
  timeHorizon?: string;
  tags: string[];
  regime: string;
  conclusion: string;
  whatChanged: Record<WindowKey, string[]>;
  confidence: Confidence;
  retrievedAt: string;
  metrics: SeriesResult[];
  news: NewsItem[];
  scenarios: ScenarioConfig[];
  actors: string[];
  catalysts: string[];
  methodology?: string;
  citations: Citation[];
  analytics?: {
    correlations?: {
      pair: string;
      value: number;
      date: string;
      observations: Observation[];
    }[];
  };
  children: PanelSnapshot[];
}

export interface DashboardSnapshot {
  tab: TabId;
  label: string;
  objective: string;
  regimeQuestion: string;
  generatedAt: string;
  retrievedAt: string;
  globalRegime: string;
  topConclusions: string[];
  topMetrics: SeriesResult[];
  panels: PanelSnapshot[];
  sourceHealth: SourceHealth[];
  errors: string[];
}

export interface SourceHealth {
  sourceId: string;
  ok: boolean;
  checkedAt: string;
  latencyMs?: number;
  status?: number;
  error?: string;
}
