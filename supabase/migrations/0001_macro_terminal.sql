create extension if not exists pgcrypto;

create table if not exists public.data_sources (
  id text primary key,
  name text not null,
  kind text not null,
  base_url text not null,
  human_url text not null,
  cadence text not null default 'varies',
  requires_key boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raw_payloads (
  cache_key text primary key,
  source_id text references public.data_sources(id) on delete set null,
  url text not null,
  payload jsonb,
  content_type text,
  status integer,
  retrieved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  error text
);

create table if not exists public.macro_series (
  id text primary key,
  label text not null,
  source_id text references public.data_sources(id) on delete set null,
  source_series_id text not null,
  unit text,
  frequency text,
  seasonal_adjustment text,
  source_url text not null,
  human_url text not null,
  description text,
  tags text[] not null default '{}',
  importance integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.macro_observations (
  series_id text references public.macro_series(id) on delete cascade,
  observation_date date not null,
  value numeric not null,
  vintage_at timestamptz not null default now(),
  source_retrieved_at timestamptz not null default now(),
  source_url text not null,
  metadata jsonb not null default '{}',
  primary key (series_id, observation_date)
);

create index if not exists macro_observations_series_date_idx
  on public.macro_observations (series_id, observation_date desc);

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  source_id text references public.data_sources(id) on delete set null,
  feed_url text not null,
  title text not null,
  url text not null unique,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  summary text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'
);

create table if not exists public.panel_snapshots (
  id uuid primary key default gen_random_uuid(),
  tab_id text not null,
  panel_id text not null,
  snapshot jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source_count integer not null default 0,
  confidence numeric,
  unique (tab_id, panel_id, generated_at)
);

create index if not exists panel_snapshots_lookup_idx
  on public.panel_snapshots (tab_id, panel_id, generated_at desc);

create table if not exists public.source_health (
  source_id text primary key references public.data_sources(id) on delete cascade,
  ok boolean not null,
  checked_at timestamptz not null default now(),
  latency_ms integer,
  status integer,
  error text,
  metadata jsonb not null default '{}'
);

create table if not exists public.refresh_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  refreshed_series integer not null default 0,
  refreshed_news integer not null default 0,
  errors jsonb not null default '[]'
);

create table if not exists public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  tab_id text not null,
  panel_id text not null,
  model text not null,
  prompt_hash text not null,
  summary text not null,
  citations jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (tab_id, panel_id, model, prompt_hash)
);

create table if not exists public.user_layouts (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  tab_id text not null,
  layout jsonb not null,
  favorites text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_key, tab_id)
);

alter table public.data_sources enable row level security;
alter table public.raw_payloads enable row level security;
alter table public.macro_series enable row level security;
alter table public.macro_observations enable row level security;
alter table public.news_items enable row level security;
alter table public.panel_snapshots enable row level security;
alter table public.source_health enable row level security;
alter table public.refresh_runs enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.user_layouts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'data_sources' and policyname = 'Public read data sources') then
    create policy "Public read data sources" on public.data_sources for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'macro_series' and policyname = 'Public read macro series') then
    create policy "Public read macro series" on public.macro_series for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'macro_observations' and policyname = 'Public read observations') then
    create policy "Public read observations" on public.macro_observations for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'news_items' and policyname = 'Public read news') then
    create policy "Public read news" on public.news_items for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'panel_snapshots' and policyname = 'Public read snapshots') then
    create policy "Public read snapshots" on public.panel_snapshots for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'source_health' and policyname = 'Public read source health') then
    create policy "Public read source health" on public.source_health for select using (true);
  end if;
end
$$;
