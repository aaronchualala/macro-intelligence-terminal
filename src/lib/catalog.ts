import type { NewsFeedConfig, PanelConfig, SeriesConfig, SourceDefinition, TabConfig } from "@/lib/types";

export const DATA_SOURCES: SourceDefinition[] = [
  {
    id: "fred",
    name: "Federal Reserve Economic Data",
    kind: "fred",
    baseUrl: "https://fred.stlouisfed.org",
    humanUrl: "https://fred.stlouisfed.org",
    cadence: "source-specific, usually daily/monthly/quarterly",
    notes: "FRED graph CSV endpoint is used when no FRED API key is supplied."
  },
  {
    id: "treasury",
    name: "U.S. Treasury Fiscal Data",
    kind: "treasury",
    baseUrl: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service",
    humanUrl: "https://fiscaldata.treasury.gov",
    cadence: "daily/monthly/as-needed",
    notes: "Open U.S. Treasury Fiscal Service API."
  },
  {
    id: "federal_reserve",
    name: "Federal Reserve",
    kind: "rss",
    baseUrl: "https://www.federalreserve.gov",
    humanUrl: "https://www.federalreserve.gov/newsevents.htm",
    cadence: "as released"
  },
  {
    id: "bls",
    name: "Bureau of Labor Statistics",
    kind: "rss",
    baseUrl: "https://www.bls.gov",
    humanUrl: "https://www.bls.gov/bls/newsrels.htm",
    cadence: "scheduled releases"
  },
  {
    id: "bea",
    name: "Bureau of Economic Analysis",
    kind: "rss",
    baseUrl: "https://www.bea.gov",
    humanUrl: "https://www.bea.gov/news/current-releases",
    cadence: "scheduled releases"
  },
  {
    id: "white_house",
    name: "The White House",
    kind: "rss",
    baseUrl: "https://www.whitehouse.gov",
    humanUrl: "https://www.whitehouse.gov/briefing-room/",
    cadence: "as released"
  },
  {
    id: "cftc",
    name: "Commodity Futures Trading Commission",
    kind: "cftc",
    baseUrl: "https://www.cftc.gov",
    humanUrl: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
    cadence: "weekly"
  },
  {
    id: "yahoo",
    name: "Yahoo Finance chart endpoint",
    kind: "market",
    baseUrl: "https://query1.finance.yahoo.com",
    humanUrl: "https://finance.yahoo.com",
    cadence: "intraday/daily",
    notes: "Used for no-key public market history; quote pages are linked for human review."
  },
  {
    id: "sec",
    name: "SEC EDGAR",
    kind: "sec",
    baseUrl: "https://www.sec.gov",
    humanUrl: "https://www.sec.gov/edgar/search/",
    cadence: "as filed"
  },
  {
    id: "bis",
    name: "Bank for International Settlements",
    kind: "rss",
    baseUrl: "https://www.bis.org",
    humanUrl: "https://www.bis.org",
    cadence: "as released"
  },
  {
    id: "ecb",
    name: "European Central Bank",
    kind: "rss",
    baseUrl: "https://www.ecb.europa.eu",
    humanUrl: "https://www.ecb.europa.eu/press/html/index.en.html",
    cadence: "as released"
  },
  {
    id: "brookings",
    name: "Brookings Institution",
    kind: "rss",
    baseUrl: "https://www.brookings.edu",
    humanUrl: "https://www.brookings.edu",
    cadence: "as published"
  },
  {
    id: "cfr",
    name: "Council on Foreign Relations",
    kind: "rss",
    baseUrl: "https://www.cfr.org",
    humanUrl: "https://www.cfr.org",
    cadence: "as published"
  },
  {
    id: "alpha_vantage",
    name: "Alpha Vantage free tier",
    kind: "alpha_vantage",
    baseUrl: "https://www.alphavantage.co",
    humanUrl: "https://www.alphavantage.co/documentation/",
    cadence: "free-tier rate limited",
    requiresKey: true
  },
  {
    id: "methodology",
    name: "Dashboard scenario methodology",
    kind: "manual_methodology",
    baseUrl: "https://github.com",
    humanUrl: "https://github.com",
    cadence: "model generated from cited public indicators",
    notes: "Scenario probabilities are model estimates, not source-published probabilities."
  }
];

const fred = (
  id: string,
  label: string,
  unit: string,
  transform: SeriesConfig["transform"],
  description: string,
  importance = 70,
  tags: string[] = [],
  polarity: SeriesConfig["polarity"] = "neutral"
): SeriesConfig => ({
  id: `fred:${id}`,
  label,
  source: "fred",
  sourceId: "fred",
  unit,
  transform,
  frequency: "source-defined",
  sourceUrl: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`,
  humanUrl: `https://fred.stlouisfed.org/series/${id}`,
  description,
  importance,
  tags,
  fredSeriesId: id,
  polarity
});

const market = (
  symbol: string,
  label: string,
  description: string,
  importance = 60,
  tags: string[] = []
): SeriesConfig => ({
  id: `market:${symbol}`,
  label,
  source: "market",
  sourceId: "yahoo",
  unit: "index/price",
  transform: "price",
  frequency: "daily",
  sourceUrl: `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`,
  humanUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
  description,
  importance,
  tags,
  marketSymbol: symbol,
  polarity: "neutral"
});

const alphaOverview = (symbol: string, field: string, label: string, description: string, importance = 50): SeriesConfig => ({
  id: `alpha:${symbol}:${field}`,
  label,
  source: "alpha_vantage",
  sourceId: "alpha_vantage",
  unit: "ratio",
  transform: "level",
  frequency: "latest",
  sourceUrl: `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}`,
  humanUrl: `https://www.alphavantage.co/documentation/#company-overview`,
  description,
  importance,
  tags: ["fundamentals", symbol],
  alphaVantage: { functionName: "OVERVIEW", symbol, field },
  polarity: "neutral"
});

const treasury = (
  id: string,
  label: string,
  endpoint: string,
  dateField: string,
  valueField: string,
  fields: string[],
  description: string,
  importance = 65,
  filter?: string,
  sort?: string
): SeriesConfig => ({
  id: `treasury:${id}`,
  label,
  source: "treasury",
  sourceId: "treasury",
  unit: "USD",
  transform: "flow",
  frequency: "source-defined",
  sourceUrl: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/${endpoint}`,
  humanUrl: "https://fiscaldata.treasury.gov",
  description,
  importance,
  tags: ["fiscal", "treasury"],
  treasury: {
    endpoint,
    dateField,
    valueField,
    fields,
    filter,
    sort,
    pageSize: 10000
  },
  polarity: "neutral"
});

const cftc = (marketName: string, label: string, value: "net_noncommercial" | "open_interest", importance = 55): SeriesConfig => ({
  id: `cftc:${marketName}:${value}`,
  label,
  source: "cftc",
  sourceId: "cftc",
  unit: "contracts",
  transform: "level",
  frequency: "weekly",
  sourceUrl: "https://www.cftc.gov/dea/newcot/deafut.txt",
  humanUrl: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
  description: `Latest CFTC legacy futures positioning for ${marketName}.`,
  importance,
  tags: ["positioning", "cot", marketName],
  cftc: { marketName, value },
  polarity: "neutral"
});

const feed = (id: string, sourceId: string, url: string, tags: string[], importance = 50): NewsFeedConfig => ({
  id,
  sourceId,
  url,
  tags,
  importance
});

const officialFeeds = {
  fed: feed("fed-all", "federal_reserve", "https://www.federalreserve.gov/feeds/press_all.xml", ["fed", "monetary"], 80),
  treasury: feed("treasury-press", "treasury", "https://home.treasury.gov/news/press-releases/rss", ["treasury", "fiscal"], 80),
  whiteHouse: feed("white-house", "white_house", "https://www.whitehouse.gov/feed/", ["policy", "executive"], 65),
  bls: feed("bls-latest", "bls", "https://www.bls.gov/feed/news_release_latest.rss", ["economy", "labor", "prices"], 70),
  bea: feed("bea-news", "bea", "https://www.bea.gov/news/rss.xml", ["economy", "gdp", "pce"], 70),
  bis: feed("bis-latest", "bis", "https://www.bis.org/rss/bis_latest.xml", ["liquidity", "banking"], 70),
  ecb: feed("ecb-press", "ecb", "https://www.ecb.europa.eu/rss/press.html", ["ecb", "monetary"], 70),
  sec: feed("sec-current", "sec", "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=40&output=atom", ["filings", "corporate"], 60),
  brookings: feed("brookings", "brookings", "https://www.brookings.edu/feed/", ["policy", "macro"], 45),
  cfr: feed("cfr", "cfr", "https://www.cfr.org/rss.xml", ["geopolitics", "policy"], 55)
};

const gdpPanel: PanelConfig = {
  id: "gdp",
  title: "GDP",
  summary: "Growth level, real activity impulse, and output-gap pressure.",
  description: "Tracks whether the U.S. real economy is accelerating, decelerating, or running above potential.",
  importance: 82,
  tags: ["growth", "bea", "cycle"],
  series: [
    fred("A191RL1Q225SBEA", "Real GDP growth", "percent", "rate", "Quarterly real GDP annualized growth.", 90, ["growth"], "higher_is_hotter"),
    fred("GDPC1", "Real GDP level", "bil. chained USD", "level", "Real gross domestic product level.", 75, ["growth"]),
    fred("GDPPOT", "Potential GDP", "bil. chained USD", "level", "CBO estimate of real potential output.", 55, ["output-gap"]),
    fred("GDI", "Gross domestic income", "bil. USD", "level", "Income-side check on GDP signal.", 55, ["growth"])
  ],
  newsFeeds: [officialFeeds.bea],
  methodology: "Growth regime compares latest annualized GDP, real GDP versus potential, and income-side confirmation. Percentiles use available FRED history."
};

const laborPanel: PanelConfig = {
  id: "labor",
  title: "Labor",
  summary: "Employment momentum, slack, wage pressure, and claims.",
  description: "Labor data determines soft-landing credibility, services inflation persistence, and Fed reaction function risk.",
  importance: 90,
  tags: ["labor", "wages", "claims"],
  series: [
    fred("PAYEMS", "Nonfarm payrolls", "thous.", "level", "Total nonfarm payroll employment.", 92, ["jobs"], "higher_is_hotter"),
    fred("UNRATE", "Unemployment rate", "percent", "rate", "Civilian unemployment rate.", 88, ["slack"], "higher_is_tighter"),
    fred("ICSA", "Initial jobless claims", "persons", "level", "Weekly initial unemployment insurance claims.", 82, ["claims"], "higher_is_tighter"),
    fred("JTSJOL", "Job openings", "thous.", "level", "JOLTS total nonfarm job openings.", 72, ["jolts"], "higher_is_hotter"),
    fred("CIVPART", "Labor force participation", "percent", "rate", "Civilian labor-force participation rate.", 58, ["supply"]),
    fred("CES0500000003", "Average hourly earnings", "USD/hour", "level", "Average hourly earnings, total private.", 76, ["wages"], "higher_is_hotter")
  ],
  newsFeeds: [officialFeeds.bls],
  methodology: "Labor tightness combines unemployment, claims, job openings, and wage growth. Market sensitivity is highest when labor data changes expected Fed timing."
};

const pricesPanel: PanelConfig = {
  id: "prices",
  title: "Prices",
  summary: "CPI/PCE/PPI inflation mix, breadth, and market-implied inflation.",
  description: "Inflation determines real-rate pressure, Fed optionality, and duration/equity multiple sensitivity.",
  importance: 96,
  tags: ["inflation", "cpi", "pce", "ppi"],
  series: [
    fred("CPIAUCSL", "CPI headline", "index", "index", "Consumer Price Index for all urban consumers.", 94, ["cpi"], "higher_is_hotter"),
    fred("CPILFESL", "CPI core", "index", "index", "CPI excluding food and energy.", 96, ["cpi", "core"], "higher_is_hotter"),
    fred("PCEPI", "PCE headline", "index", "index", "Personal consumption expenditures price index.", 88, ["pce"], "higher_is_hotter"),
    fred("PCEPILFE", "PCE core", "index", "index", "Core PCE price index.", 92, ["pce", "core"], "higher_is_hotter"),
    fred("PPIACO", "PPI all commodities", "index", "index", "Producer price index: all commodities.", 58, ["ppi"], "higher_is_hotter"),
    fred("T10YIE", "10Y breakeven inflation", "percent", "rate", "Market-implied 10-year inflation compensation.", 78, ["breakeven"], "higher_is_hotter"),
    fred("T5YIE", "5Y breakeven inflation", "percent", "rate", "Market-implied 5-year inflation compensation.", 72, ["breakeven"], "higher_is_hotter")
  ],
  children: [
    {
      id: "prices-cpi",
      title: "CPI Decomposition",
      summary: "Headline/core CPI with shelter, energy, goods, and services proxies.",
      description: "Deep CPI layer for inflation breadth and persistence. Shelter and services matter most for Fed reaction risk.",
      importance: 92,
      tags: ["cpi", "decomposition"],
      series: [
        fred("CUSR0000SAH1", "CPI shelter", "index", "index", "CPI shelter component.", 86, ["shelter"], "higher_is_hotter"),
        fred("CPIENGSL", "CPI energy", "index", "index", "CPI energy component.", 70, ["energy"], "higher_is_hotter"),
        fred("CUSR0000SACL1E", "CPI commodities ex food/energy", "index", "index", "Core goods CPI proxy.", 72, ["goods"], "higher_is_hotter"),
        fred("CUSR0000SASLE", "CPI services less energy", "index", "index", "Services CPI proxy.", 82, ["services"], "higher_is_hotter"),
        fred("CPIUFDSL", "CPI food", "index", "index", "CPI food component.", 65, ["food"], "higher_is_hotter")
      ],
      methodology: "Component heat is based on YoY, MoM, and 3-month annualized inflation where frequency permits."
    }
  ],
  newsFeeds: [officialFeeds.bls, officialFeeds.bea],
  methodology: "Inflation heat uses YoY, MoM, 3-month annualized rates, z-scores, and percentile rankings across the available public history."
};

const businessPanel: PanelConfig = {
  id: "business-activity",
  title: "Business Activity",
  summary: "Industrial production, Chicago Fed activity, and capex-sensitive orders.",
  description: "Shows cyclical production momentum and whether surveys/orders confirm hard activity.",
  importance: 72,
  tags: ["activity", "production"],
  series: [
    fred("INDPRO", "Industrial production", "index", "index", "Industrial production index.", 82, ["production"], "higher_is_hotter"),
    fred("CFNAI", "Chicago Fed National Activity Index", "index", "level", "Weighted average of national activity indicators.", 76, ["activity"], "higher_is_hotter"),
    fred("DGORDER", "Durable goods orders", "mil. USD", "flow", "Manufacturers' new orders: durable goods.", 62, ["orders"], "higher_is_hotter"),
    fred("NEWORDER", "Manufacturers new orders", "mil. USD", "flow", "Manufacturers' new orders.", 58, ["orders"], "higher_is_hotter")
  ],
  methodology: "Business activity regime weighs production momentum, activity diffusion, and order flow."
};

const consumerPanel: PanelConfig = {
  id: "consumer",
  title: "Consumer",
  summary: "Retail sales, spending, income, savings, and sentiment.",
  description: "Consumer resilience is the main transmission channel from labor/credit into earnings and nominal GDP.",
  importance: 80,
  tags: ["consumer", "spending"],
  series: [
    fred("RSAFS", "Retail sales", "mil. USD", "flow", "Advance retail and food services sales.", 86, ["sales"], "higher_is_hotter"),
    fred("PCE", "Personal consumption expenditures", "bil. USD", "flow", "Nominal personal consumption expenditures.", 80, ["pce"], "higher_is_hotter"),
    fred("DSPIC96", "Real disposable income", "bil. chained USD", "level", "Real disposable personal income.", 70, ["income"], "higher_is_hotter"),
    fred("PSAVERT", "Personal saving rate", "percent", "rate", "Personal saving as a share of disposable income.", 55, ["savings"]),
    fred("UMCSENT", "Consumer sentiment", "index", "index", "University of Michigan consumer sentiment.", 66, ["sentiment"], "higher_is_hotter"),
    fred("TOTALSL", "Consumer credit owned/securitized", "bil. USD", "level", "Total consumer credit outstanding.", 54, ["credit"])
  ],
  methodology: "Consumer impulse compares nominal spending, real income, credit reliance, and sentiment."
};

const housingPanel: PanelConfig = {
  id: "housing",
  title: "Housing",
  summary: "Rates, starts, permits, sales, and house-price pressure.",
  description: "Housing is the most rate-sensitive cyclical sector and a leading channel for monetary tightening.",
  importance: 76,
  tags: ["housing", "rates"],
  series: [
    fred("MORTGAGE30US", "30Y mortgage rate", "percent", "rate", "Freddie Mac 30-year fixed mortgage average.", 84, ["rates"], "higher_is_tighter"),
    fred("HOUST", "Housing starts", "thous. SAAR", "level", "Privately owned housing starts.", 78, ["starts"], "higher_is_hotter"),
    fred("PERMIT", "Building permits", "thous. SAAR", "level", "New private housing building permits.", 76, ["permits"], "higher_is_hotter"),
    fred("EXHOSLUSM495S", "Existing home sales", "units", "level", "Existing home sales.", 60, ["sales"], "higher_is_hotter"),
    fred("CSUSHPINSA", "Case-Shiller home price index", "index", "index", "U.S. national home price index.", 65, ["prices"], "higher_is_hotter"),
    fred("MSPUS", "Median new home sales price", "USD", "level", "Median sales price of houses sold.", 52, ["prices"], "higher_is_hotter")
  ],
  methodology: "Housing stress emphasizes mortgage-rate level, starts/permits momentum, and price stickiness."
};

const creditPanel: PanelConfig = {
  id: "credit",
  title: "Credit",
  summary: "Bank lending, corporate spreads, delinquency pressure, and credit impulse.",
  description: "Credit conditions determine recession odds, default cycle risk, and equity drawdown vulnerability.",
  importance: 86,
  tags: ["credit", "banks", "spreads"],
  series: [
    fred("BUSLOANS", "Commercial and industrial loans", "bil. USD", "level", "C&I loans at all commercial banks.", 78, ["bank-lending"], "higher_is_easier"),
    fred("TOTLL", "Loans and leases in bank credit", "bil. USD", "level", "Loans and leases at all commercial banks.", 72, ["bank-lending"], "higher_is_easier"),
    fred("BAMLH0A0HYM2", "High yield OAS", "percent", "spread", "ICE BofA U.S. high yield option-adjusted spread.", 90, ["spreads"], "higher_is_tighter"),
    fred("BAMLC0A0CM", "Investment grade OAS", "percent", "spread", "ICE BofA U.S. corporate option-adjusted spread.", 72, ["spreads"], "higher_is_tighter"),
    fred("DRCCLACBS", "Credit-card delinquency rate", "percent", "rate", "Delinquency rate on credit-card loans.", 74, ["delinquencies"], "higher_is_tighter"),
    fred("DRBLACBS", "Business loan delinquency rate", "percent", "rate", "Delinquency rate on business loans.", 68, ["delinquencies"], "higher_is_tighter")
  ],
  methodology: "Credit stress combines spread percentiles, loan growth momentum, and delinquency direction."
};

const manufacturingPanel: PanelConfig = {
  id: "manufacturing",
  title: "Manufacturing",
  summary: "ISM headline, new orders, inventories, prices, and hard orders.",
  description: "Manufacturing is globally sensitive and often leads inventory/earnings cycles.",
  importance: 66,
  tags: ["manufacturing", "ism"],
  series: [
    fred("NAPM", "ISM manufacturing PMI", "index", "index", "ISM manufacturing PMI.", 84, ["ism"], "higher_is_hotter"),
    fred("NAPMNOI", "ISM new orders", "index", "index", "ISM manufacturing new orders.", 80, ["orders"], "higher_is_hotter"),
    fred("NAPMII", "ISM inventories", "index", "index", "ISM manufacturing inventories.", 55, ["inventories"]),
    fred("NAPMPRI", "ISM prices paid", "index", "index", "ISM manufacturing prices.", 62, ["prices"], "higher_is_hotter"),
    fred("AMTMNO", "Manufacturers new orders", "mil. USD", "flow", "Manufacturers' new orders: total manufacturing.", 58, ["orders"], "higher_is_hotter")
  ],
  methodology: "Manufacturing regime centers on ISM new orders versus inventories, with prices as inflation pass-through risk."
};

const tradePanel: PanelConfig = {
  id: "trade",
  title: "Trade",
  summary: "Trade balance, exports, imports, dollar pressure, and oil import sensitivity.",
  description: "Trade data links global demand, dollar strength, tariffs, and domestic industrial momentum.",
  importance: 58,
  tags: ["trade", "dollar"],
  series: [
    fred("BOPGSTB", "Goods and services trade balance", "mil. USD", "flow", "U.S. trade balance.", 76, ["balance"]),
    fred("EXPGS", "Exports of goods and services", "bil. USD", "flow", "U.S. exports.", 64, ["exports"], "higher_is_hotter"),
    fred("IMPGS", "Imports of goods and services", "bil. USD", "flow", "U.S. imports.", 58, ["imports"]),
    fred("DTWEXBGS", "Broad dollar index", "index", "index", "Trade-weighted U.S. dollar index.", 72, ["fx"], "higher_is_tighter"),
    fred("DCOILWTICO", "WTI crude oil", "USD/bbl", "price", "WTI crude oil spot price.", 66, ["energy"])
  ],
  methodology: "Trade pressure compares external demand, import demand, dollar strength, and oil shock sensitivity."
};

const structuralPanels: PanelConfig[] = [
  {
    id: "hormuz-energy-shock",
    title: "Strait of Hormuz / Energy Shock",
    summary: "Oil-shock tail risk with inflation, shipping, and defense-policy transmission.",
    description: "Tracks whether Middle East disruption risk is large enough to move inflation expectations, risk assets, and central bank reaction functions.",
    importance: 95,
    timeHorizon: "0-3 months",
    tags: ["geopolitics", "energy", "inflation"],
    actors: ["Iran", "GCC producers", "U.S. administration", "U.S. Navy/CENTCOM", "China energy importers", "OPEC+"],
    catalysts: ["Shipping disruption", "sanctions escalation", "military incident", "OPEC+ policy shift", "insurance/freight repricing"],
    series: [
      fred("DCOILWTICO", "WTI crude oil", "USD/bbl", "price", "WTI spot crude price.", 92, ["oil", "energy"], "higher_is_hotter"),
      fred("T5YIE", "5Y breakeven inflation", "percent", "rate", "Inflation compensation sensitive to energy shocks.", 76, ["inflation"], "higher_is_hotter"),
      fred("VIXCLS", "VIX", "index", "index", "Equity implied volatility.", 70, ["risk"], "higher_is_tighter"),
      market("USO", "United States Oil Fund", "Oil ETF proxy for investable oil beta.", 62, ["oil"]),
      market("XLE", "Energy sector ETF", "U.S. energy equity leadership proxy.", 55, ["energy-equities"])
    ],
    newsFeeds: [officialFeeds.cfr, officialFeeds.whiteHouse, officialFeeds.treasury],
    scenarios: [
      {
        id: "base-contained",
        label: "Contained friction",
        probability: 0.55,
        description: "Elevated rhetoric and sanctions but no sustained physical supply disruption.",
        marketPath: "Oil risk premium fades; duration rallies if inflation expectations stay anchored.",
        triggers: ["No material tanker disruptions", "OPEC spare capacity offsets risk", "diplomatic signaling"],
        sourceIds: ["fred", "treasury", "cfr"]
      },
      {
        id: "supply-shock",
        label: "Temporary supply shock",
        probability: 0.3,
        description: "Insurance, shipping, or military events disrupt flows for days/weeks.",
        marketPath: "Oil, energy equities, breakevens, and USD higher; margins and consumers pressured.",
        triggers: ["WTI breaks above recent percentile extremes", "VIX confirms", "official shipping warnings"],
        sourceIds: ["fred", "white_house", "cfr"]
      },
      {
        id: "regional-escalation",
        label: "Regional escalation",
        probability: 0.15,
        description: "Broader conflict shifts from risk premium to macro demand/inflation shock.",
        marketPath: "Risk-off convexity, credit widening, policy uncertainty, defense/energy outperformance.",
        triggers: ["Repeated attacks", "formal military response", "sanctions broaden"],
        sourceIds: ["cfr", "treasury", "white_house"]
      }
    ],
    methodology: "Scenario probabilities are analyst priors adjusted by live oil, VIX, breakeven, and official-news pressure. They are model estimates, not official forecasts."
  },
  {
    id: "ai-capex-boom",
    title: "AI Capex Boom",
    summary: "Semiconductor, hyperscaler, power-grid, and financing impulse from AI infrastructure.",
    description: "Tracks whether AI capital expenditure remains a self-reinforcing nominal growth engine or becomes a margin/financing vulnerability.",
    importance: 92,
    timeHorizon: "1-12 months",
    tags: ["ai", "capex", "equities", "power"],
    actors: ["Hyperscalers", "semiconductor suppliers", "utilities", "data-center developers", "credit markets", "regulators"],
    catalysts: ["Mega-cap earnings", "capex guidance", "power interconnection delays", "export controls", "credit spread repricing"],
    series: [
      market("NVDA", "NVIDIA", "AI semiconductor bellwether.", 88, ["ai", "semis"]),
      market("SMH", "Semiconductor ETF", "Semiconductor breadth and AI supply-chain proxy.", 82, ["semis"]),
      market("QQQ", "Nasdaq 100 ETF", "Growth/AI beta proxy.", 74, ["growth-equities"]),
      fred("PNFI", "Private nonresidential fixed investment", "bil. USD", "flow", "Private nonresidential fixed investment.", 66, ["capex"], "higher_is_hotter"),
      fred("IPG2211A2N", "Electric power generation", "index", "index", "Electric power generation proxy for load pressure.", 45, ["power"], "higher_is_hotter")
    ],
    newsFeeds: [officialFeeds.sec, officialFeeds.whiteHouse],
    scenarios: [
      {
        id: "productivity-boom",
        label: "Productivity boom",
        probability: 0.35,
        description: "Capex converts into measurable productivity and revenue growth.",
        marketPath: "Mega-cap margins hold; semis/software leadership broadens; rates tolerate stronger growth.",
        triggers: ["Capex guidance rises with revenue", "margins hold", "power bottlenecks ease"],
        sourceIds: ["sec", "fred"]
      },
      {
        id: "capex-digestion",
        label: "Capex digestion",
        probability: 0.45,
        description: "Spend remains high but incremental returns become harder to prove.",
        marketPath: "Multiple compression risk; beneficiaries rotate from chips to power/infrastructure.",
        triggers: ["Guidance language softens", "semis lose breadth", "credit spreads widen"],
        sourceIds: ["sec", "fred"]
      },
      {
        id: "policy-bottleneck",
        label: "Power/export bottleneck",
        probability: 0.2,
        description: "Power, export controls, or geopolitical restrictions slow deployment.",
        marketPath: "Semis derate; utilities/grid equipment outperform; policy headlines dominate.",
        triggers: ["Export-control announcements", "data-center power delays", "official restrictions"],
        sourceIds: ["white_house", "sec"]
      }
    ],
    methodology: "Uses live market leadership, public capex/investment data, SEC filings feed, and policy releases to classify capex durability."
  },
  {
    id: "china-debt-deflation",
    title: "China Debt Deflation",
    summary: "China property, credit, FX, and imported-disinflation channel.",
    description: "Tracks whether China is exporting disinflation, policy stimulus, or financial stress into global assets.",
    importance: 88,
    timeHorizon: "0-6 months",
    tags: ["china", "deflation", "property", "fx"],
    actors: ["State Council", "PBOC", "local governments", "property developers", "households", "export sectors"],
    catalysts: ["PBOC easing", "property support", "CNY depreciation", "export-control retaliation", "commodity demand turns"],
    series: [
      fred("CHNCPIALLMINMEI", "China CPI", "index", "index", "China consumer price index.", 84, ["china", "prices"], "higher_is_hotter"),
      fred("DEXCHUS", "CNY per USD", "CNY/USD", "price", "Chinese yuan exchange rate versus USD.", 78, ["fx"], "higher_is_tighter"),
      market("FXI", "China large-cap ETF", "Offshore China equity proxy.", 74, ["equities"]),
      market("ASHR", "CSI 300 ETF proxy", "Mainland China A-share proxy.", 68, ["equities"]),
      fred("PIORECRUSDM", "Iron ore price", "USD/metric ton", "price", "Iron ore demand proxy when available via FRED.", 50, ["commodities"])
    ],
    newsFeeds: [officialFeeds.cfr, officialFeeds.brookings],
    scenarios: [
      {
        id: "managed-deflation",
        label: "Managed debt deflation",
        probability: 0.5,
        description: "Policy offsets tail risk but does not reflate household/property confidence.",
        marketPath: "Lower goods inflation, weaker commodities, episodic China equity rallies fade.",
        triggers: ["CPI remains weak", "CNY controlled", "stimulus incremental"],
        sourceIds: ["fred", "cfr"]
      },
      {
        id: "credit-reflation",
        label: "Credit reflation",
        probability: 0.3,
        description: "Authorities accept stronger credit impulse and fiscal support.",
        marketPath: "Commodities, EM, and cyclicals outperform; global yields higher.",
        triggers: ["Large fiscal/property program", "CNY stabilizes", "commodities confirm"],
        sourceIds: ["brookings", "fred"]
      },
      {
        id: "fx-stress",
        label: "FX / confidence stress",
        probability: 0.2,
        description: "Capital-flow or property stress forces sharper depreciation pressure.",
        marketPath: "USD higher, Asia FX pressure, global disinflation impulse, risk-off volatility.",
        triggers: ["CNY percentile break", "equities fail policy rallies", "official stress headlines"],
        sourceIds: ["fred", "cfr"]
      }
    ],
    methodology: "China probabilities combine public CPI/FX data, offshore equity proxies, commodity signal, and CFR/Brookings policy flow."
  },
  {
    id: "fiscal-dominance",
    title: "Fiscal Dominance / Term Premium",
    summary: "Deficit, debt stock, issuance mix, auction absorption, and rates volatility.",
    description: "Tests whether fiscal supply is becoming the dominant macro shock relative to cyclical data.",
    importance: 86,
    timeHorizon: "0-12 months",
    tags: ["fiscal", "term-premium", "treasury"],
    actors: ["U.S. Treasury", "Congress", "White House", "primary dealers", "foreign reserve managers", "Fed"],
    catalysts: ["Quarterly refunding", "debt ceiling", "tax/budget bills", "weak auctions", "rating actions"],
    series: [
      fred("GFDEBTN", "Federal debt", "mil. USD", "level", "Federal debt: total public debt.", 86, ["debt"], "higher_is_tighter"),
      fred("FYFSD", "Federal surplus/deficit", "mil. USD", "flow", "Federal surplus or deficit.", 80, ["deficit"], "higher_is_tighter"),
      fred("DGS10", "10Y Treasury yield", "percent", "rate", "10-year Treasury constant maturity yield.", 82, ["rates"], "higher_is_tighter"),
      fred("MOVE", "MOVE index", "index", "index", "Treasury implied volatility index where available.", 70, ["vol"], "higher_is_tighter"),
      treasury("auctions-total-accepted", "Treasury auction accepted amount", "v1/accounting/od/auctions_query", "record_date", "total_accepted", ["record_date", "security_type", "total_accepted"], "Total accepted amount across Treasury auctions.", 72, "record_date:gte:2020-01-01", "-record_date")
    ],
    newsFeeds: [officialFeeds.treasury, officialFeeds.whiteHouse],
    scenarios: [
      {
        id: "absorbed-supply",
        label: "Supply absorbed",
        probability: 0.45,
        description: "Demand clears issuance without persistent term-premium pressure.",
        marketPath: "Curve steepening contained; risk assets follow growth/inflation data.",
        triggers: ["Stable auction metrics", "MOVE contained", "10Y range holds"],
        sourceIds: ["treasury", "fred"]
      },
      {
        id: "term-premium-shock",
        label: "Term-premium shock",
        probability: 0.35,
        description: "Supply and deficit concerns lift long-end yields independent of growth.",
        marketPath: "Curve bear-steepens; equities multiple pressure; dollar may rise on real yields.",
        triggers: ["Weak auction demand", "MOVE spikes", "deficit headlines worsen"],
        sourceIds: ["treasury", "fred"]
      },
      {
        id: "financial-repression",
        label: "Repression/liquidity response",
        probability: 0.2,
        description: "Policy leans toward liquidity support or regulatory absorption of duration.",
        marketPath: "Nominal yields capped, real assets supported, banks/liquidity channels matter.",
        triggers: ["Regulatory changes", "liquidity operations", "funding stress"],
        sourceIds: ["federal_reserve", "treasury"]
      }
    ],
    methodology: "Inspired by fiscal-dominance frameworks: issuance, debt/deficit trajectory, auction absorption, MOVE, and curve pressure."
  },
  {
    id: "taiwan-supply-chain",
    title: "Taiwan / Supply Chain Redundancy",
    summary: "Semiconductor concentration, export controls, and redundancy capex.",
    description: "Maps geopolitical tail risk into semiconductors, electronics supply chains, defense, and industrial policy.",
    importance: 80,
    timeHorizon: "0-18 months",
    tags: ["taiwan", "semiconductors", "supply-chain"],
    actors: ["Taiwan government", "China", "U.S. administration", "TSMC", "semiconductor equipment suppliers", "Japan/EU industrial policy"],
    catalysts: ["Military exercises", "export controls", "elections/policy statements", "CHIPS funding", "company capex guidance"],
    series: [
      market("TSM", "TSMC ADR", "Taiwan semiconductor concentration proxy.", 86, ["semis", "taiwan"]),
      market("SMH", "Semiconductor ETF", "Global semiconductor proxy.", 72, ["semis"]),
      market("ITA", "Aerospace & defense ETF", "Defense equity sensitivity proxy.", 52, ["defense"]),
      fred("A019RE1Q156NBEA", "Equipment investment contribution", "percent points", "flow", "Equipment investment contribution to GDP growth.", 48, ["capex"])
    ],
    newsFeeds: [officialFeeds.cfr, officialFeeds.sec, officialFeeds.whiteHouse],
    scenarios: [
      {
        id: "status-quo",
        label: "Status quo deterrence",
        probability: 0.6,
        description: "High rhetoric but no acute disruption.",
        marketPath: "Semis trade earnings cycle; defense premium steady.",
        triggers: ["No material military escalation", "export controls incremental"],
        sourceIds: ["cfr", "sec"]
      },
      {
        id: "policy-friction",
        label: "Export-control friction",
        probability: 0.3,
        description: "Restrictions or retaliation alter semiconductor supply-chain economics.",
        marketPath: "Equipment/China-exposed semis derate; domestic industrial policy beneficiaries improve.",
        triggers: ["New restrictions", "retaliatory measures", "guidance cuts"],
        sourceIds: ["white_house", "sec"]
      },
      {
        id: "security-crisis",
        label: "Security crisis",
        probability: 0.1,
        description: "Military incident creates non-linear supply-chain and risk-asset shock.",
        marketPath: "Semis gap lower, defense/volatility higher, USD and Treasuries bid initially.",
        triggers: ["Blockade exercise", "kinetic incident", "official travel crisis"],
        sourceIds: ["cfr", "white_house"]
      }
    ],
    methodology: "Scenario tree follows constraints/preferences logic: actors want leverage but generally avoid supply-chain self-harm unless domestic/security constraints dominate."
  },
  {
    id: "dollar-stablecoins",
    title: "Stablecoins / Dollarization",
    summary: "Digital-dollar demand, T-bill collateral, regulation, and offshore dollar plumbing.",
    description: "Tracks whether stablecoin growth strengthens T-bill demand and dollar network effects or creates funding/regulatory vulnerabilities.",
    importance: 68,
    timeHorizon: "3-18 months",
    tags: ["stablecoins", "dollar", "bills"],
    actors: ["U.S. Treasury", "Congress", "stablecoin issuers", "banks", "offshore users", "SEC/CFTC"],
    catalysts: ["Stablecoin legislation", "issuer reserve disclosures", "T-bill supply changes", "banking rules", "crypto risk events"],
    series: [
      fred("DTB3", "3M Treasury bill rate", "percent", "rate", "Secondary-market 3-month bill rate.", 76, ["bills"], "higher_is_tighter"),
      fred("WTREGEN", "Treasury General Account", "mil. USD", "balance_sheet", "U.S. Treasury deposits at the Fed.", 62, ["liquidity"]),
      fred("DTWEXBGS", "Broad dollar index", "index", "index", "Trade-weighted U.S. dollar index.", 72, ["dollar"], "higher_is_tighter"),
      market("BTC-USD", "Bitcoin", "Crypto liquidity/risk appetite proxy.", 44, ["crypto"])
    ],
    newsFeeds: [officialFeeds.treasury, officialFeeds.whiteHouse, officialFeeds.sec],
    scenarios: [
      {
        id: "regulated-growth",
        label: "Regulated growth",
        probability: 0.5,
        description: "Legislation clarifies reserves and supports bill demand.",
        marketPath: "Bills demand supported; dollar network effects strengthen; bank deposit competition rises.",
        triggers: ["Legislation advances", "issuer reserves grow", "bill supply attractive"],
        sourceIds: ["treasury", "sec"]
      },
      {
        id: "fragmented-rules",
        label: "Fragmented regulation",
        probability: 0.35,
        description: "Regulatory uncertainty keeps adoption uneven.",
        marketPath: "Limited macro effect; crypto beta remains liquidity-driven.",
        triggers: ["Agency conflict", "delayed bills", "enforcement-driven policy"],
        sourceIds: ["sec", "white_house"]
      },
      {
        id: "reserve-stress",
        label: "Reserve confidence stress",
        probability: 0.15,
        description: "Issuer or collateral event creates redemption pressure.",
        marketPath: "T-bill microstructure stress possible; crypto drawdown; flight to quality.",
        triggers: ["Stablecoin depeg", "reserve disclosure concerns", "crypto exchange stress"],
        sourceIds: ["sec", "treasury"]
      }
    ],
    methodology: "Combines policy feed, bill rates, Treasury cash/liquidity, dollar strength, and crypto risk appetite."
  },
  {
    id: "nuclear-uranium",
    title: "Uranium / Nuclear Buildout",
    summary: "Energy security, baseload power, data-center load, and industrial policy.",
    description: "Monitors the nuclear/uranium theme as a structural energy-security and AI-power bottleneck response.",
    importance: 62,
    timeHorizon: "6-36 months",
    tags: ["nuclear", "uranium", "energy-security"],
    actors: ["Utilities", "U.S. Department of Energy", "reactor vendors", "uranium miners", "data-center operators", "regulators"],
    catalysts: ["Reactor approvals", "utility PPAs", "uranium supply disruptions", "DOE funding", "data-center power contracts"],
    series: [
      market("URA", "Global X Uranium ETF", "Uranium miners and nuclear-fuel equity proxy.", 74, ["uranium"]),
      market("CCJ", "Cameco", "Uranium producer proxy.", 68, ["uranium"]),
      fred("IPG2211A2N", "Electric power generation", "index", "index", "Power generation pressure proxy.", 50, ["power"]),
      fred("DHHNGSP", "Henry Hub natural gas", "USD/MMBtu", "price", "Competing marginal power fuel price.", 46, ["energy"])
    ],
    newsFeeds: [officialFeeds.whiteHouse, officialFeeds.sec],
    scenarios: [
      {
        id: "steady-buildout",
        label: "Steady buildout",
        probability: 0.55,
        description: "Policy support and private PPAs extend the nuclear cycle.",
        marketPath: "Uranium/nuclear equities supported; utilities with credible power supply advantaged.",
        triggers: ["New PPAs", "reactor approvals", "funding announcements"],
        sourceIds: ["white_house", "sec"]
      },
      {
        id: "permitting-delay",
        label: "Permitting delay",
        probability: 0.3,
        description: "Regulatory and construction timelines slow the expected supply response.",
        marketPath: "Equity theme narrows; gas/power prices stay more sensitive.",
        triggers: ["Project delays", "cost overruns", "regulatory setbacks"],
        sourceIds: ["sec", "white_house"]
      },
      {
        id: "supply-squeeze",
        label: "Fuel supply squeeze",
        probability: 0.15,
        description: "Geopolitical or mining disruptions tighten uranium fuel availability.",
        marketPath: "Uranium miners outperform; utility input risk rises.",
        triggers: ["Sanctions", "mine disruptions", "inventory drawdowns"],
        sourceIds: ["white_house", "sec"]
      }
    ],
    methodology: "Theme score uses uranium equities, power generation pressure, natural-gas substitution, policy news, and filings."
  }
];

export const TABS: TabConfig[] = [
  {
    id: "structural",
    label: "Structural",
    objective: "Secular and idiosyncratic macro/geopolitical themes ranked by next-three-month market criticality.",
    regimeQuestion: "Which structural risk has the highest probability-weighted market impact now?",
    panels: structuralPanels
  },
  {
    id: "economic",
    label: "Economic",
    objective: "U.S. cyclical economy: growth, labor, prices, activity, consumer, housing, credit, manufacturing, and trade.",
    regimeQuestion: "Is the U.S. economy accelerating, slowing benignly, or entering stress?",
    panels: [gdpPanel, laborPanel, pricesPanel, businessPanel, consumerPanel, housingPanel, creditPanel, manufacturingPanel, tradePanel]
  },
  {
    id: "fiscal",
    label: "Fiscal",
    objective: "U.S. fiscal policy, Treasury issuance, deficits, bills, executive actions, sanctions, and industrial policy.",
    regimeQuestion: "Is fiscal policy easing financial conditions, tightening term premium, or changing sector winners?",
    panels: [
      {
        id: "deficit-impulse",
        title: "Deficit / Fiscal Impulse",
        summary: "Deficit trajectory, federal receipts/outlays, and nominal demand impulse.",
        description: "Quantifies whether federal fiscal flow is supporting nominal growth or adding term-premium risk.",
        importance: 92,
        tags: ["deficit", "impulse"],
        series: [
          fred("FYFSD", "Federal surplus/deficit", "mil. USD", "flow", "Federal surplus or deficit.", 90, ["deficit"], "higher_is_tighter"),
          fred("FGRECPT", "Federal receipts", "bil. USD", "flow", "Federal government current receipts.", 68, ["receipts"], "higher_is_hotter"),
          fred("FGEXPND", "Federal expenditures", "bil. USD", "flow", "Federal government current expenditures.", 76, ["outlays"], "higher_is_hotter"),
          fred("A084RC1Q027SBEA", "Federal government consumption/investment", "bil. USD", "flow", "Federal consumption expenditures and gross investment.", 65, ["spending"])
        ],
        newsFeeds: [officialFeeds.treasury, officialFeeds.whiteHouse],
        methodology: "Fiscal impulse uses deficit direction, receipts/outlays gap, and federal spending growth."
      },
      {
        id: "treasury-issuance",
        title: "Treasury Issuance / Refunding",
        summary: "Auction supply, bill/coupon mix, maturity profile, and absorption risk.",
        description: "Tracks Treasury auction composition and market sensitivity around refunding statements.",
        importance: 90,
        tags: ["issuance", "auction", "refunding"],
        series: [
          treasury("auction-total", "Auction total accepted", "v1/accounting/od/auctions_query", "record_date", "total_accepted", ["record_date", "security_type", "total_accepted"], "Treasury auction total accepted amount.", 84, "record_date:gte:2022-01-01", "-record_date"),
          fred("DGS2", "2Y Treasury yield", "percent", "rate", "2-year Treasury yield.", 74, ["front-end"], "higher_is_tighter"),
          fred("DGS10", "10Y Treasury yield", "percent", "rate", "10-year Treasury yield.", 82, ["long-end"], "higher_is_tighter"),
          fred("T10Y2Y", "10Y-2Y Treasury spread", "percent", "spread", "Treasury curve slope.", 68, ["curve"]),
          fred("MOVE", "MOVE index", "index", "index", "Treasury implied volatility index where available.", 72, ["vol"], "higher_is_tighter")
        ],
        newsFeeds: [officialFeeds.treasury],
        methodology: "Issuance stress compares accepted auction size, curve behavior, and rates volatility. Detailed bill/coupon split is available in the raw Treasury API response metadata."
      },
      {
        id: "policy-bills",
        title: "Major Bills / Executive Actions",
        summary: "Legislative and executive policy flow with fiscal and sector consequences.",
        description: "Ranks policy developments by market urgency, fiscal size, and sector impact.",
        importance: 78,
        tags: ["legislation", "executive-actions", "industrial-policy"],
        newsFeeds: [officialFeeds.whiteHouse, officialFeeds.treasury, officialFeeds.brookings],
        series: [
          fred("GCEC1", "Government consumption expenditures", "bil. chained USD", "flow", "Real government consumption expenditures and gross investment.", 62, ["government-spending"]),
          market("ITA", "Aerospace & defense ETF", "Defense-sector policy sensitivity proxy.", 50, ["defense"]),
          market("XLI", "Industrials ETF", "Industrial-policy equity sensitivity proxy.", 45, ["industrials"])
        ],
        methodology: "Policy panel is news-first but constrained by live spending and sector-market confirmation."
      },
      {
        id: "sanctions-export-controls",
        title: "Sanctions / Export Controls",
        summary: "Treasury/White House restrictions with FX, commodity, and sector transmission.",
        description: "Monitors official sanctions/export-control flow and market channels.",
        importance: 72,
        tags: ["sanctions", "export-controls", "geopolitics"],
        newsFeeds: [officialFeeds.treasury, officialFeeds.whiteHouse, officialFeeds.cfr],
        series: [
          fred("DTWEXBGS", "Broad dollar index", "index", "index", "Trade-weighted dollar.", 70, ["dollar"], "higher_is_tighter"),
          market("SMH", "Semiconductor ETF", "Export-control exposed sector proxy.", 64, ["semis"]),
          fred("DCOILWTICO", "WTI crude oil", "USD/bbl", "price", "Oil sanctions channel.", 58, ["oil"])
        ],
        methodology: "Uses official release feeds and market proxies for sanction-sensitive channels."
      }
    ]
  },
  {
    id: "monetary",
    label: "Monetary",
    objective: "G7/China central banks, balance sheets, reserves, funding markets, bank lending, and liquidity impulse.",
    regimeQuestion: "Is marginal global liquidity improving, draining, or creating funding stress?",
    panels: [
      {
        id: "fed-liquidity",
        title: "Fed Liquidity",
        summary: "Balance sheet, reserves, reverse repo, TGA, SOFR/EFFR plumbing.",
        description: "The core U.S. liquidity stack: Fed assets, reserve balances, ON RRP, Treasury cash, and money-market rates.",
        importance: 96,
        tags: ["fed", "liquidity", "reserves"],
        series: [
          fred("WALCL", "Fed total assets", "mil. USD", "balance_sheet", "Federal Reserve total assets.", 90, ["balance-sheet"], "higher_is_easier"),
          fred("WRESBAL", "Reserve balances", "bil. USD", "balance_sheet", "Reserve balances with Federal Reserve Banks.", 92, ["reserves"], "higher_is_easier"),
          fred("RRPONTSYD", "ON RRP", "bil. USD", "balance_sheet", "Overnight reverse repo accepted amount.", 84, ["rrp"], "higher_is_tighter"),
          fred("WTREGEN", "Treasury General Account", "mil. USD", "balance_sheet", "Treasury General Account at the Fed.", 82, ["tga"], "higher_is_tighter"),
          fred("SOFR", "SOFR", "percent", "rate", "Secured Overnight Financing Rate.", 76, ["funding"], "higher_is_tighter"),
          fred("EFFR", "Effective fed funds rate", "percent", "rate", "Effective Federal Funds Rate.", 72, ["policy"], "higher_is_tighter")
        ],
        newsFeeds: [officialFeeds.fed],
        methodology: "Liquidity impulse favors changes over levels: reserves less RRP/TGA pressure, with SOFR/EFFR as stress checks."
      },
      {
        id: "global-central-banks",
        title: "G7 + China Central Banks",
        summary: "Policy rates, guidance, and balance-sheet direction across major central banks.",
        description: "Monitors the relative policy/liquidity impulse from Fed, ECB, BOJ, BOE, PBOC, SNB, and BOC.",
        importance: 84,
        tags: ["g7", "central-banks", "china"],
        series: [
          fred("ECBDFR", "ECB deposit facility rate", "percent", "rate", "ECB deposit facility rate where available.", 78, ["ecb"], "higher_is_tighter"),
          fred("IR3TIB01JPM156N", "Japan 3M interbank rate", "percent", "rate", "Japan short-rate proxy.", 62, ["boj"], "higher_is_tighter"),
          fred("IR3TIB01GBM156N", "UK 3M interbank rate", "percent", "rate", "UK short-rate proxy.", 62, ["boe"], "higher_is_tighter"),
          fred("IR3TIB01CAM156N", "Canada 3M interbank rate", "percent", "rate", "Canada short-rate proxy.", 58, ["boc"], "higher_is_tighter"),
          fred("IR3TIB01CHM156N", "Switzerland 3M interbank rate", "percent", "rate", "Swiss short-rate proxy.", 54, ["snb"], "higher_is_tighter"),
          fred("DEXCHUS", "CNY per USD", "CNY/USD", "price", "China FX pressure as PBOC constraint proxy.", 58, ["pboc"], "higher_is_tighter")
        ],
        newsFeeds: [officialFeeds.ecb, officialFeeds.bis, officialFeeds.fed],
        methodology: "Global central bank panel compares short-rate levels/changes and guidance releases. Some non-U.S. rate proxies are interbank series where official balance sheet feeds are not normalized in FRED."
      },
      {
        id: "funding-stress",
        title: "Funding Stress / GSIB Plumbing",
        summary: "NFCI, repo, SOFR, spreads, bank credit, and volatility.",
        description: "Funding stress can force policy/liquidity responses independent of macro data.",
        importance: 88,
        tags: ["funding", "gsib", "repo"],
        series: [
          fred("NFCI", "Chicago Fed NFCI", "index", "index", "National Financial Conditions Index.", 88, ["financial-conditions"], "higher_is_tighter"),
          fred("ANFCI", "Adjusted NFCI", "index", "index", "Adjusted financial conditions index.", 80, ["financial-conditions"], "higher_is_tighter"),
          fred("SOFR", "SOFR", "percent", "rate", "Secured overnight financing rate.", 76, ["repo"], "higher_is_tighter"),
          fred("BAMLH0A0HYM2", "High yield OAS", "percent", "spread", "High yield spread.", 74, ["credit"], "higher_is_tighter"),
          fred("BUSLOANS", "C&I loans", "bil. USD", "level", "Commercial and industrial loans.", 60, ["bank-lending"], "higher_is_easier"),
          fred("VIXCLS", "VIX", "index", "index", "Equity implied volatility.", 66, ["vol"], "higher_is_tighter")
        ],
        newsFeeds: [officialFeeds.bis, officialFeeds.fed],
        methodology: "Funding stress regime prioritizes NFCI percentile, repo-rate stability, credit spreads, bank credit contraction, and volatility confirmation."
      },
      {
        id: "policy-expectations",
        title: "Policy Expectations / Guidance",
        summary: "Front-end rates, real yields, breakevens, and central-bank speech flow.",
        description: "Expected policy path is proxied by front-end yields and inflation compensation, then cross-checked with official guidance.",
        importance: 82,
        tags: ["fed", "expectations", "real-rates"],
        series: [
          fred("DGS2", "2Y Treasury yield", "percent", "rate", "2-year Treasury yield.", 84, ["front-end"], "higher_is_tighter"),
          fred("DFII10", "10Y TIPS yield", "percent", "rate", "10-year inflation-indexed Treasury yield.", 80, ["real-rates"], "higher_is_tighter"),
          fred("T10YIE", "10Y breakeven", "percent", "rate", "10-year breakeven inflation.", 70, ["inflation"]),
          fred("T5YIFR", "5Y5Y forward inflation expectation", "percent", "rate", "Market-implied 5-year forward inflation compensation.", 68, ["inflation"]),
          fred("FEDFUNDS", "Fed funds target/effective proxy", "percent", "rate", "Federal funds rate monthly history.", 62, ["policy"], "higher_is_tighter")
        ],
        newsFeeds: [officialFeeds.fed],
        methodology: "Policy expectations compare front-end rates, real yields, and inflation compensation with latest Fed communications."
      }
    ]
  },
  {
    id: "corporate",
    label: "Corporate",
    objective: "Global equity fundamentals, earnings, revisions proxies, factor/sector leadership, concentration, and AI capex.",
    regimeQuestion: "Are earnings fundamentals broadening, narrowing into mega-cap concentration, or rolling over?",
    panels: [
      {
        id: "us-indexes",
        title: "U.S. Indexes",
        summary: "SPX, Nasdaq, Russell, breadth proxies, and concentration pressure.",
        description: "Price, breadth, and size leadership determine whether equity strength is durable or fragile.",
        importance: 90,
        tags: ["equities", "us"],
        series: [
          market("SPY", "S&P 500 ETF", "S&P 500 investable proxy.", 90, ["spx"]),
          market("QQQ", "Nasdaq 100 ETF", "Nasdaq 100 growth proxy.", 86, ["nasdaq"]),
          market("IWM", "Russell 2000 ETF", "Small-cap equity proxy.", 72, ["small-caps"]),
          market("RSP", "Equal-weight S&P 500 ETF", "Breadth/equal-weight proxy.", 74, ["breadth"]),
          market("MAGS", "Magnificent Seven ETF", "Mega-cap concentration proxy.", 66, ["concentration"])
        ],
        newsFeeds: [officialFeeds.sec],
        methodology: "Breadth is proxied by equal-weight versus cap-weighted performance and small caps versus large caps."
      },
      {
        id: "global-indexes",
        title: "Global Indexes",
        summary: "EuroStoxx, Nikkei, Hang Seng/China, DAX, FTSE, and global leadership.",
        description: "Cross-regional leadership helps identify dollar, rates, China, and earnings regime shifts.",
        importance: 78,
        tags: ["global-equities"],
        series: [
          market("FEZ", "EuroStoxx 50 ETF", "Euro-area equity proxy.", 70, ["europe"]),
          market("EWJ", "Japan ETF", "Nikkei/Japan equity proxy.", 70, ["japan"]),
          market("EWH", "Hong Kong ETF", "Hang Seng proxy.", 60, ["hong-kong"]),
          market("ASHR", "CSI 300 ETF proxy", "China A-share proxy.", 62, ["china"]),
          market("EWG", "Germany ETF", "DAX/Germany proxy.", 56, ["germany"]),
          market("EWU", "United Kingdom ETF", "FTSE/UK proxy.", 52, ["uk"])
        ],
        methodology: "Uses liquid U.S.-listed country ETFs as investable no-key proxies when direct exchange APIs are unavailable."
      },
      {
        id: "sector-leadership",
        title: "Sector Leadership",
        summary: "Sector rotation, defensives/cyclicals, margins, and factor pressure.",
        description: "Sector leadership reveals whether equity returns are driven by growth, liquidity, inflation, or defensive positioning.",
        importance: 82,
        tags: ["sectors", "factors"],
        series: [
          market("XLK", "Technology", "S&P technology sector ETF.", 76, ["tech"]),
          market("XLF", "Financials", "S&P financials sector ETF.", 70, ["financials"]),
          market("XLI", "Industrials", "S&P industrials sector ETF.", 64, ["industrials"]),
          market("XLE", "Energy", "S&P energy sector ETF.", 64, ["energy"]),
          market("XLV", "Health care", "S&P health care sector ETF.", 58, ["defensive"]),
          market("XLP", "Consumer staples", "S&P consumer staples sector ETF.", 54, ["defensive"])
        ],
        methodology: "Sector regime ranks relative performance across cyclicals, defensives, duration-sensitive, and commodity-sensitive sectors."
      },
      {
        id: "mega-cap-fundamentals",
        title: "Mega-Cap / AI Fundamentals",
        summary: "Optional free-tier fundamentals plus SEC filings for AI capex leaders.",
        description: "Uses Alpha Vantage free-tier fields when an API key is supplied; otherwise exposes filings and price/leadership signals without fabricating values.",
        importance: 80,
        tags: ["fundamentals", "ai"],
        series: [
          market("MSFT", "Microsoft", "Mega-cap AI capex leader.", 70, ["ai"]),
          market("GOOGL", "Alphabet", "Hyperscaler AI capex leader.", 68, ["ai"]),
          market("AMZN", "Amazon", "Cloud/AI capex leader.", 66, ["ai"]),
          market("META", "Meta Platforms", "AI capex and ads margin leader.", 64, ["ai"]),
          alphaOverview("MSFT", "PERatio", "Microsoft P/E", "Alpha Vantage company overview P/E ratio.", 50),
          alphaOverview("NVDA", "PEGRatio", "NVIDIA PEG", "Alpha Vantage company overview PEG ratio.", 48),
          alphaOverview("AMZN", "EVToEBITDA", "Amazon EV/EBITDA", "Alpha Vantage company overview EV/EBITDA.", 45)
        ],
        newsFeeds: [officialFeeds.sec],
        methodology: "Fundamentals are only shown when retrieved from free-tier APIs or filings. Missing-key values are marked unavailable rather than estimated."
      }
    ]
  },
  {
    id: "positioning",
    label: "Positioning",
    objective: "Financial conditions, real rates, volatility, credit, futures positioning, flows proxies, and crowdedness.",
    regimeQuestion: "Where is the market most crowded or vulnerable to a squeeze?",
    panels: [
      {
        id: "financial-conditions",
        title: "Financial Conditions",
        summary: "Real rates, NFCI, credit spreads, VIX/MOVE, and liquidity-sensitive stress.",
        description: "Combines price of money, credit risk, and volatility into a vulnerability dashboard.",
        importance: 94,
        tags: ["financial-conditions", "risk"],
        series: [
          fred("DFII10", "10Y real yield", "percent", "rate", "10-year TIPS yield.", 90, ["real-rates"], "higher_is_tighter"),
          fred("NFCI", "Chicago Fed NFCI", "index", "index", "National Financial Conditions Index.", 90, ["conditions"], "higher_is_tighter"),
          fred("VIXCLS", "VIX", "index", "index", "Equity implied volatility.", 82, ["vol"], "higher_is_tighter"),
          fred("MOVE", "MOVE", "index", "index", "Treasury volatility.", 74, ["rates-vol"], "higher_is_tighter"),
          fred("BAMLH0A0HYM2", "HY OAS", "percent", "spread", "High yield credit spread.", 88, ["credit"], "higher_is_tighter")
        ],
        methodology: "Stress percentiles drive squeeze risk: tight spreads plus low vol imply complacency; high real rates plus widening spreads imply fragility."
      },
      {
        id: "cot-positioning",
        title: "Futures Positioning / CoT",
        summary: "CFTC net speculative positioning across rates, FX, equities, and commodities.",
        description: "Weekly CFTC positioning identifies crowded directional exposures and squeeze risk.",
        importance: 78,
        tags: ["cot", "futures"],
        series: [
          cftc("S&P 500", "S&P 500 futures net non-commercial", "net_noncommercial", 72),
          cftc("NASDAQ", "Nasdaq futures net non-commercial", "net_noncommercial", 68),
          cftc("U.S. TREASURY BONDS", "Treasury bond futures net non-commercial", "net_noncommercial", 64),
          cftc("EURO FX", "Euro FX futures net non-commercial", "net_noncommercial", 58),
          cftc("GOLD", "Gold futures net non-commercial", "net_noncommercial", 62),
          cftc("CRUDE OIL", "Crude oil futures net non-commercial", "net_noncommercial", 62)
        ],
        methodology: "Latest net non-commercial positions are parsed from CFTC public reports; percentile requires available history and is marked unavailable if the current weekly file is all that can be retrieved."
      },
      {
        id: "flow-and-cta-proxies",
        title: "ETF / CTA Proxies",
        summary: "Trend, breadth, and liquid ETF proxies for systematic positioning.",
        description: "A practical no-paid-data approach to CTA and flow risk: price trends, realized momentum, and crowded ETF leadership.",
        importance: 70,
        tags: ["cta", "flows", "trend"],
        series: [
          market("SPY", "SPY", "Equity trend proxy.", 72, ["equities"]),
          market("TLT", "TLT", "Long-duration Treasury trend proxy.", 66, ["rates"]),
          market("UUP", "UUP", "U.S. dollar ETF trend proxy.", 62, ["fx"]),
          market("GLD", "GLD", "Gold ETF trend proxy.", 62, ["gold"]),
          market("USO", "USO", "Oil ETF trend proxy.", 60, ["oil"]),
          market("HYG", "HYG", "High-yield ETF price proxy.", 64, ["credit"])
        ],
        methodology: "CTA proxy is trend-based: rolling returns/z-scores identify assets where systematic exposure is likely one-sided. It is a proxy, not a broker flow dataset."
      }
    ]
  },
  {
    id: "correlation",
    label: "Correlation",
    objective: "Cross-asset correlation, rolling betas, factor maps, inflation/growth/liquidity regimes, and diversification quality.",
    regimeQuestion: "Are bonds diversifying equities, amplifying inflation risk, or both assets trading one liquidity factor?",
    panels: [
      {
        id: "cross-asset-map",
        title: "Cross-Asset Regime Map",
        summary: "SPX/Nasdaq, 2Y/10Y, dollar, oil, gold, credit, Bitcoin, and FX proxies.",
        description: "Rolling correlations reveal whether markets are trading growth, inflation, policy, or liquidity.",
        importance: 96,
        tags: ["correlation", "cross-asset"],
        series: [
          market("SPY", "S&P 500", "Equity risk proxy.", 90, ["equities"]),
          market("QQQ", "Nasdaq 100", "Growth equity proxy.", 82, ["equities"]),
          fred("DGS2", "2Y yield", "percent", "rate", "2-year Treasury yield.", 86, ["rates"], "higher_is_tighter"),
          fred("DGS10", "10Y yield", "percent", "rate", "10-year Treasury yield.", 86, ["rates"], "higher_is_tighter"),
          fred("DTWEXBGS", "Broad dollar", "index", "index", "Trade-weighted dollar.", 78, ["fx"], "higher_is_tighter"),
          fred("DCOILWTICO", "Oil", "USD/bbl", "price", "WTI crude oil.", 76, ["oil"]),
          fred("GOLDAMGBD228NLBM", "Gold", "USD/oz", "price", "London gold fixing price.", 72, ["gold"]),
          fred("BAMLH0A0HYM2", "HY spread", "percent", "spread", "High yield OAS.", 78, ["credit"], "higher_is_tighter"),
          market("BTC-USD", "Bitcoin", "Crypto liquidity proxy.", 62, ["crypto"]),
          market("FXE", "Euro ETF", "EUR/USD proxy.", 50, ["fx"]),
          market("FXY", "Yen ETF", "JPY proxy.", 50, ["fx"])
        ],
        methodology: "Returns are aligned by date. Rolling correlations use daily changes for yields/spreads and log returns for prices. Regime labels compare equity-rate, equity-dollar, equity-oil, and credit-equity correlations."
      },
      {
        id: "bond-equity-diversification",
        title: "Bond / Equity Diversification",
        summary: "Whether rates hedge equity risk or join the same inflation/liquidity drawdown.",
        description: "The core portfolio construction question: equity drawdowns are less diversifiable when stocks and bonds sell off together.",
        importance: 88,
        tags: ["portfolio", "duration", "diversification"],
        series: [
          market("SPY", "S&P 500 ETF", "Equity proxy.", 86, ["equities"]),
          market("TLT", "20Y+ Treasury ETF", "Duration proxy.", 84, ["duration"]),
          fred("DFII10", "10Y real yield", "percent", "rate", "Real-rate pressure.", 76, ["real-rates"], "higher_is_tighter"),
          fred("T10YIE", "10Y breakeven", "percent", "rate", "Inflation compensation.", 72, ["inflation"], "higher_is_hotter")
        ],
        methodology: "A positive equity-duration correlation during rising real yields indicates diversification failure; negative correlation with falling yields indicates classic growth-shock hedge."
      },
      {
        id: "liquidity-factor",
        title: "Liquidity Factor",
        summary: "Dollar, real rates, credit, Bitcoin/growth equities, and liquidity co-movement.",
        description: "Tests whether assets are dominated by one liquidity factor rather than idiosyncratic fundamentals.",
        importance: 82,
        tags: ["liquidity", "factor"],
        series: [
          fred("WRESBAL", "Reserve balances", "bil. USD", "balance_sheet", "Fed reserves.", 78, ["liquidity"], "higher_is_easier"),
          fred("DTWEXBGS", "Broad dollar", "index", "index", "Dollar liquidity proxy.", 78, ["dollar"], "higher_is_tighter"),
          fred("DFII10", "10Y real yield", "percent", "rate", "Real-rate liquidity pressure.", 76, ["real-rates"], "higher_is_tighter"),
          market("QQQ", "Nasdaq 100", "Growth/liquidity equity proxy.", 72, ["growth"]),
          market("BTC-USD", "Bitcoin", "High beta liquidity proxy.", 62, ["crypto"]),
          fred("BAMLH0A0HYM2", "HY spread", "percent", "spread", "Credit risk/liquidity proxy.", 72, ["credit"], "higher_is_tighter")
        ],
        methodology: "Liquidity factor is inferred from common directionality among dollar, real yields, credit spreads, growth equities, crypto, and reserve balances."
      }
    ]
  }
];

export function getTabConfig(tab: string | null | undefined) {
  return TABS.find((item) => item.id === tab) ?? TABS[1];
}

export function getSource(sourceId: string) {
  return DATA_SOURCES.find((source) => source.id === sourceId);
}

export function flattenPanels(panels: PanelConfig[]): PanelConfig[] {
  return panels.flatMap((panel) => [panel, ...flattenPanels(panel.children ?? [])]);
}

export function allSeries() {
  const seen = new Map<string, SeriesConfig>();
  for (const tab of TABS) {
    for (const panel of flattenPanels(tab.panels)) {
      for (const series of panel.series ?? []) {
        seen.set(series.id, series);
      }
    }
  }
  return [...seen.values()];
}

export function allFeeds() {
  const seen = new Map<string, NewsFeedConfig>();
  for (const tab of TABS) {
    for (const panel of flattenPanels(tab.panels)) {
      for (const newsFeed of panel.newsFeeds ?? []) {
        seen.set(newsFeed.id, newsFeed);
      }
    }
  }
  return [...seen.values()];
}
