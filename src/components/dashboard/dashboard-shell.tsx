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
import { useEffect, useMemo, useState } from "react";

import { MacroPanel } from "@/components/dashboard/macro-panel";
import { MetricStrip } from "@/components/dashboard/metric-grid";
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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [urlStateReady, setUrlStateReady] = useState(false);
  const busy = refreshing || Boolean(loadingLabel);

  useEffect(() => {
    const stored = window.localStorage.getItem("macro-terminal:favorites");
    if (stored) queueMicrotask(() => setFavorites(new Set(JSON.parse(stored) as string[])));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expandedParam = params.get("expanded");
    if (expandedParam) {
      setExpanded(new Set(expandedParam.split(",").map((item) => item.trim()).filter(Boolean)));
    }
    setUrlStateReady(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("macro-terminal:favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    if (!urlStateReady) return;
    const params = new URLSearchParams(window.location.search);
    params.set("tab", snapshot.tab);
    if (expanded.size) params.set("expanded", [...expanded].join(","));
    else params.delete("expanded");
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [snapshot.tab, expanded, urlStateReady]);

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

  async function fetchSnapshot(tab: TabId, force = false) {
    const response = await fetch(`/api/dashboard?tab=${tab}${force ? "&force=1" : ""}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${tab}: ${response.status}`);
    return (await response.json()) as DashboardSnapshot;
  }

  async function loadTab(tab: TabId, force = false) {
    if (busy) return;
    const label = tabs.find((item) => item.id === tab)?.label ?? "tab";
    setLoadingLabel(tab === snapshot.tab ? "Reloading data" : `Loading ${label}`);
    setRefreshMessage(null);
    try {
      const data = await fetchSnapshot(tab, force);
      setSnapshot(data);
      setExpanded(new Set());
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingLabel(null);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setLoadingLabel("Refreshing live data");
    setRefreshMessage(null);
    try {
      let token = window.localStorage.getItem("macro-terminal:admin-token");
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const refreshUrl = `/api/etl/${snapshot.tab}?scope=critical&limit=24&news=0`;
      let response = await fetch(refreshUrl, {
        method: "POST",
        headers
      });
      if (response.status === 401) {
        token = window.prompt("Enter dashboard refresh token") ?? "";
        if (token) {
          window.localStorage.setItem("macro-terminal:admin-token", token);
          response = await fetch(refreshUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.status === 401) {
            window.localStorage.removeItem("macro-terminal:admin-token");
            throw new Error("Refresh token was rejected.");
          }
        } else {
          throw new Error("Refresh token required.");
        }
      }
      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }
      const result = (await response.json()) as { refreshedSeries?: number; errors?: string[]; error?: string };
      if (result.error) throw new Error(result.error);
      const data = await fetchSnapshot(snapshot.tab, true);
      setSnapshot(data);
      setExpanded(new Set());
      const sourceIssues = result.errors?.length ?? 0;
      if (sourceIssues) {
        setRefreshMessage(`Refresh finished with ${sourceIssues} source issue${sourceIssues === 1 ? "" : "s"}.`);
      } else if (!data.topMetrics.length) {
        setRefreshMessage("Refresh finished, but no metrics were cached. Check the refresh token and source health.");
      } else {
        setRefreshMessage(`Refresh complete: ${result.refreshedSeries ?? data.topMetrics.length} series updated.`);
      }
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
      setLoadingLabel(null);
    }
  }

  const healthy = snapshot.sourceHealth.filter((source) => source.ok).length;
  const totalHealth = snapshot.sourceHealth.length;

  return (
    <main className="min-h-screen bg-[#050505] text-neutral-100">
      {busy ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 backdrop-blur-[1px]" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-3 border border-neutral-700 bg-black/85 px-4 py-3 text-xs uppercase tracking-wide text-neutral-200 shadow-2xl">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {loadingLabel ?? "Loading"}
          </div>
        </div>
      ) : null}
      <div className={`mx-auto flex max-w-[1900px] flex-col gap-3 p-3 md:p-4 xl:p-5 ${busy ? "pointer-events-none select-none" : ""}`}>
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
            <p className="max-w-5xl text-sm leading-6 text-neutral-400">{snapshot.objective}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[440px]">
            <div className="flex items-center gap-2 border border-neutral-800 bg-black px-2">
              <Search className="h-4 w-4 shrink-0 text-neutral-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={busy}
                placeholder="Search panels, tags, series"
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
              />
            </div>
            <Button onClick={refresh} disabled={busy} variant="secondary">
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
              disabled={busy}
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
