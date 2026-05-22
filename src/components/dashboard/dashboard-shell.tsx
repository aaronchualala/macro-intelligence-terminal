"use client";

import {
  ChevronDownSquare,
  ChevronUpSquare,
  DatabaseZap,
  Heart,
  RefreshCw,
  Search,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { MacroPanel } from "@/components/dashboard/macro-panel";
import { MetricStrip } from "@/components/dashboard/metric-grid";
import { TradingViewTape } from "@/components/dashboard/tradingview-tape";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardSnapshot, PanelSnapshot, TabId } from "@/lib/types";
import { freshnessLabel } from "@/lib/utils";

function flatten(panels: PanelSnapshot[]): PanelSnapshot[] {
  return panels.flatMap((panel) => [panel, ...flatten(panel.children)]);
}

function filterPanels(panels: PanelSnapshot[], query: string, favoritesOnly: boolean, favorites: Set<string>): PanelSnapshot[] {
  const normalized = query.trim().toLowerCase();
  return panels
    .map((panel) => ({
      ...panel,
      children: filterPanels(panel.children, query, favoritesOnly, favorites)
    }))
    .filter((panel) => {
      const matchesFavorite = !favoritesOnly || favorites.has(panel.id);
      const matchesQuery =
        !normalized ||
        [panel.title, panel.summary, panel.description, panel.regime, ...panel.tags].join(" ").toLowerCase().includes(normalized) ||
        panel.metrics.some((metric) => metric.config.label.toLowerCase().includes(normalized));
      return (matchesFavorite && matchesQuery) || panel.children.length > 0;
    });
}

export function DashboardShell({
  initialSnapshot,
  tabs
}: {
  initialSnapshot: DashboardSnapshot;
  tabs: { id: TabId; label: string }[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialSnapshot.panels.slice(0, 2).map((panel) => panel.id)));
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem("macro-terminal:favorites");
    if (stored) queueMicrotask(() => setFavorites(new Set(JSON.parse(stored) as string[])));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("macro-terminal:favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", snapshot.tab);
    if (expanded.size) params.set("expanded", [...expanded].join(","));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [snapshot.tab, expanded]);

  const visiblePanels = useMemo(
    () => filterPanels(snapshot.panels, query, favoritesOnly, favorites),
    [snapshot.panels, query, favoritesOnly, favorites]
  );
  const allPanelIds = useMemo(() => flatten(snapshot.panels).map((panel) => panel.id), [snapshot.panels]);

  function togglePanel(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadTab(tab: TabId, force = false) {
    startTransition(() => {
      void (async () => {
        const response = await fetch(`/api/dashboard?tab=${tab}${force ? "&force=1" : ""}`, { cache: "no-store" });
        const data = (await response.json()) as DashboardSnapshot;
        setSnapshot(data);
        setExpanded(new Set(data.panels.slice(0, 2).map((panel) => panel.id)));
      })();
    });
  }

  async function refresh() {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      let token = window.localStorage.getItem("macro-terminal:admin-token");
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`/api/etl/${snapshot.tab}?scope=critical`, {
        method: "POST",
        headers
      });
      if (response.status === 401) {
        token = window.prompt("Enter dashboard refresh token") ?? "";
        if (token) {
          window.localStorage.setItem("macro-terminal:admin-token", token);
          const retry = await fetch(`/api/etl/${snapshot.tab}?scope=critical`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!retry.ok) throw new Error(`Refresh failed: ${retry.status}`);
        } else {
          throw new Error("Refresh token required.");
        }
      } else if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }
      await loadTab(snapshot.tab, true);
      setRefreshMessage("Refresh complete");
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  }

  const healthy = snapshot.sourceHealth.filter((source) => source.ok).length;
  const totalHealth = snapshot.sourceHealth.length;

  return (
    <main className="min-h-screen bg-[#050505] text-neutral-100">
      <TradingViewTape />
      <div className="mx-auto flex max-w-[1900px] flex-col gap-3 p-3 md:p-4 xl:p-5">
        <header className="grid gap-3 border-b border-neutral-900 pb-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500">
              <span>{process.env.NEXT_PUBLIC_APP_NAME ?? "Macro Intelligence"}</span>
              <span>Generated {freshnessLabel(snapshot.generatedAt)}</span>
              <Badge tone={snapshot.globalRegime.includes("tight") ? "risk" : snapshot.globalRegime.includes("easing") ? "good" : "neutral"}>
                {snapshot.globalRegime}
              </Badge>
              {totalHealth ? (
                <Badge tone={healthy === totalHealth ? "good" : "warn"}>
                  {healthy}/{totalHealth} sources healthy
                </Badge>
              ) : null}
            </div>
            <h1 className="text-xl font-semibold tracking-normal text-neutral-50 md:text-2xl">Institutional Macro Terminal</h1>
            <p className="mt-1 max-w-5xl text-sm leading-6 text-neutral-400">{snapshot.objective}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[440px]">
            <div className="flex items-center gap-2 border border-neutral-800 bg-black px-2">
              <Search className="h-4 w-4 shrink-0 text-neutral-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search panels, tags, series"
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
              />
            </div>
            <Button onClick={refresh} disabled={refreshing || isPending} variant="secondary">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <nav className="terminal-scrollbar flex gap-px overflow-x-auto border border-neutral-800 bg-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => loadTab(tab.id)}
              className={`h-10 shrink-0 px-3 text-xs font-medium uppercase tracking-wide transition ${
                tab.id === snapshot.tab ? "bg-neutral-100 text-black" : "bg-[#080808] text-neutral-300 hover:bg-neutral-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0">
            <MetricStrip metrics={snapshot.topMetrics} />
          </div>
          <aside className="grid gap-px overflow-hidden border border-neutral-800 bg-neutral-800">
            <div className="bg-black p-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Regime conclusions
              </div>
              <ul className="space-y-2 text-xs leading-5 text-neutral-300">
                {snapshot.topConclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {refreshMessage ? <div className="bg-black px-3 py-2 text-xs text-neutral-400">{refreshMessage}</div> : null}
            {snapshot.errors.length ? (
              <div className="bg-black px-3 py-2 text-xs leading-5 text-yellow-200">
                {snapshot.errors.slice(0, 3).map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            ) : null}
          </aside>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-neutral-900 py-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setExpanded(new Set(allPanelIds))}>
              <ChevronDownSquare className="h-4 w-4" />
              Expand all
            </Button>
            <Button variant="ghost" onClick={() => setExpanded(new Set())}>
              <ChevronUpSquare className="h-4 w-4" />
              Collapse all
            </Button>
            <Button variant={favoritesOnly ? "default" : "ghost"} onClick={() => setFavoritesOnly((value) => !value)}>
              <Heart className="h-4 w-4" />
              Favorites
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500">
            <DatabaseZap className="h-3.5 w-3.5" />
            {visiblePanels.length} top panels · URL state persisted
          </div>
        </div>

        <section className="grid gap-2">
          {visiblePanels.map((panel) => (
            <MacroPanel
              key={panel.id}
              panel={panel}
              expanded={expanded.has(panel.id)}
              isExpanded={(id) => expanded.has(id)}
              onToggle={togglePanel}
              tab={snapshot.tab}
              isFavorite={(id) => favorites.has(id)}
              onFavoriteToggle={toggleFavorite}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
