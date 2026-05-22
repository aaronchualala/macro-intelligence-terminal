# Macro Intelligence Terminal

Production-ready personal macro dashboard built with Next.js, TypeScript, TailwindCSS, Supabase/Postgres, Vercel cron, public data sources, and optional OpenAI summaries.

## What It Does

- Seven tabs: Structural, Economic, Fiscal, Monetary, Corporate, Positioning, Correlation.
- Progressive disclosure: regime headline first, then metrics, charts, source links, news, scenarios, methodology, and raw CSV downloads.
- Live public sources only: FRED, Treasury Fiscal Data, Federal Reserve, BLS/BEA release feeds, CFTC CoT, SEC EDGAR, ECB/BIS/CFR/Brookings/White House feeds, Yahoo Finance chart endpoint, and optional Alpha Vantage free tier.
- Durable caching and stale fallback through Supabase `raw_payloads`.
- Scheduled refresh through Vercel cron plus protected in-app manual refresh.
- AI regime summaries through OpenAI Responses API when `OPENAI_API_KEY` is configured; otherwise deterministic source-grounded summaries are returned.

## Architecture

`src/lib/catalog.ts` is the source map for the terminal. Each panel declares its real data series, source links, news feeds, scenario tree, actor constraints, catalysts, and methodology.

`src/lib/data/providers.ts` adapts each public source into a common `{ observations, citation }` shape.

`src/lib/data/analytics.ts` computes latest/prior, MoM, YoY, 3-month annualized changes, z-scores, percentiles, rolling correlations, and regime labels.

`src/lib/data/engine.ts` builds fast cached dashboard snapshots from Supabase and runs tab-scoped ETL refreshes.

`src/app/api/etl/[tab]/route.ts` is the preferred ETL entry point. Each tab can be refreshed independently, which keeps the UI fast and prevents one slow public source from blocking the whole dashboard.

`src/app/api/dashboard/route.ts` reads cached Supabase observations/news only. It does not live-fetch public sources on page load.

## Folder Structure

```text
src/app                  Next.js app router pages and API routes
src/components/dashboard Dense terminal UI, panels, charts, TradingView tape
src/components/ui        Small shadcn-style primitives
src/lib/catalog.ts       Tabs, panels, real source catalog
src/lib/data             Fetch, cache, providers, analytics, snapshot engine
supabase/migrations      Postgres schema
scripts/refresh.ts       CLI refresh utility
scripts/refresh-tab.ts   Tab-scoped CLI refresh utility
```

## Database

Run `supabase/migrations/0001_macro_terminal.sql` in Supabase SQL editor or via the Supabase CLI. The schema includes:

- `data_sources`
- `raw_payloads`
- `macro_series`
- `macro_observations`
- `news_items`
- `panel_snapshots`
- `source_health`
- `refresh_runs`
- `ai_summaries`
- `user_layouts`

Public read policies are enabled for non-sensitive market/source data. Writes require the server-side service role key.

## Environment

Copy `.env.example` into Vercel project environment variables.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended:

- `CRON_SECRET`
- `DASHBOARD_ADMIN_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `FRED_API_KEY`
- `ALPHAVANTAGE_API_KEY`

The FRED graph CSV endpoint works without a key. Alpha Vantage fundamentals are marked unavailable until a free key is supplied.

## Deploy

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_macro_terminal.sql`.
3. Create a Vercel project from this repo.
4. Add the environment variables above.
5. Deploy.
6. Open `/api/sources/health` to verify source connectivity.
7. Open the app and run manual refresh once with `DASHBOARD_ADMIN_TOKEN`.

Vercel cron schedules are in `vercel.json`. On Vercel Hobby, cron is intentionally limited, so this repo schedules only one daily tab refresh by default:

- daily Economic critical refresh

For the intended split-pipeline model, add external schedulers or separate tiny worker projects that call:

```text
POST /api/etl/structural?scope=critical
POST /api/etl/economic?scope=critical
POST /api/etl/fiscal?scope=critical
POST /api/etl/monetary?scope=critical
POST /api/etl/corporate?scope=critical
POST /api/etl/positioning?scope=critical
POST /api/etl/correlation?scope=critical
```

Use the `CRON_SECRET` or `DASHBOARD_ADMIN_TOKEN` bearer token for each call.

Local/worker refresh:

```bash
npm run refresh:tab -- economic critical
npm run refresh:tab -- monetary critical
npm run refresh:tab -- correlation all
```

## Data Integrity

The app does not fabricate missing values. If a free-tier key is missing, a source rate-limits, or a series is unavailable, the metric is shown as unavailable with the error and source metadata. Supabase stale cache is used only as a labeled fallback after live fetch failure.

## Maintenance

- Review source health after deployment and adjust any retired public endpoints in `src/lib/catalog.ts`.
- Add new panels by extending `TABS` with real source definitions and methodology notes.
- Keep `next`, `react`, and security-sensitive packages current.
- Watch free-tier API limits, especially Alpha Vantage.
- For personal production use, set `CRON_SECRET` and `DASHBOARD_ADMIN_TOKEN`.

## Roadmap

- Add authenticated user accounts and server-side favorites/layouts.
- Add EDGAR companyfacts extraction for trailing margins/buybacks.
- Add normalized central-bank balance-sheet adapters for ECB/BOJ/BOE/PBOC.
- Add CFTC historical archives for true positioning percentiles.
- Add alert rules and daily email/Slack digest.
- Add portfolio watchlists and asset-specific sensitivity models.
