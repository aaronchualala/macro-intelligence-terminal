"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Newspaper,
  Star,
  StarOff
} from "lucide-react";
import { useState } from "react";

import { CorrelationChart } from "@/components/dashboard/charts";
import { MetricDetail, MetricStrip } from "@/components/dashboard/metric-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PanelSnapshot } from "@/lib/types";
import { formatNumber, freshnessLabel } from "@/lib/utils";

function confidenceTone(confidence: string) {
  if (confidence === "high") return "good" as const;
  if (confidence === "medium") return "warn" as const;
  if (confidence === "low") return "warn" as const;
  return "risk" as const;
}

function ScenarioTree({ panel }: { panel: PanelSnapshot }) {
  if (!panel.scenarios.length) return null;
  return (
    <div className="border border-neutral-800">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-400">
        <GitBranch className="h-3.5 w-3.5" />
        Probability-weighted scenarios
      </div>
      <div className="grid gap-px bg-neutral-800 md:grid-cols-3">
        {panel.scenarios.map((scenario) => (
          <div key={scenario.id} className="bg-[#080808] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-neutral-100">{scenario.label}</h4>
              <span className="text-lg font-semibold tabular-nums">{Math.round(scenario.probability * 100)}%</span>
            </div>
            <p className="text-xs leading-5 text-neutral-400">{scenario.description}</p>
            <p className="mt-2 text-xs leading-5 text-neutral-300">{scenario.marketPath}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {scenario.triggers.slice(0, 4).map((trigger) => (
                <Badge key={trigger}>{trigger}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsBlock({ panel }: { panel: PanelSnapshot }) {
  if (!panel.news.length) return null;
  return (
    <div className="border border-neutral-800">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-400">
        <Newspaper className="h-3.5 w-3.5" />
        Latest source flow
      </div>
      <div className="divide-y divide-neutral-900">
        {panel.news.slice(0, 6).map((item) => (
          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block px-3 py-2 hover:bg-neutral-950">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm text-neutral-100">{item.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-neutral-500">
                  {item.sourceName} · {item.publishedAt ? freshnessLabel(item.publishedAt) : "release date n/a"}
                </p>
              </div>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function CorrelationBlock({ panel }: { panel: PanelSnapshot }) {
  const correlations = panel.analytics?.correlations ?? [];
  if (!correlations.length) return null;
  return (
    <div className="border border-neutral-800">
      <div className="border-b border-neutral-800 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-400">
        Rolling correlation diagnostics
      </div>
      <div className="grid gap-px bg-neutral-800 lg:grid-cols-2">
        {correlations.slice(0, 4).map((item) => (
          <div key={item.pair} className="bg-[#080808] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-neutral-200">{item.pair}</span>
              <Badge tone={Math.abs(item.value) > 0.6 ? "warn" : "neutral"}>{item.value.toFixed(2)}</Badge>
            </div>
            <CorrelationChart data={item.observations} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MacroPanel({
  panel,
  expanded,
  isExpanded,
  onToggle,
  tab,
  depth = 0,
  isFavorite,
  onFavoriteToggle
}: {
  panel: PanelSnapshot;
  expanded: boolean;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  tab: string;
  depth?: number;
  isFavorite: (id: string) => boolean;
  onFavoriteToggle: (id: string) => void;
}) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const topMetric = panel.metrics[0];
  const favorite = isFavorite(panel.id);

  async function summarize() {
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, panelId: panel.id })
      });
      const data = (await response.json()) as { summary?: string; error?: string; mode?: string };
      setAiSummary(data.summary ?? data.error ?? "Summary unavailable.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <article className="border border-neutral-800 bg-[#080808]">
      <button
        onClick={() => onToggle(panel.id)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 text-left transition hover:bg-neutral-950 md:p-4"
      >
        <div className="pt-1 text-neutral-400">{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">Rank {panel.importance}</span>
            <Badge tone={confidenceTone(panel.confidence)}>{panel.confidence}</Badge>
            {panel.timeHorizon ? <Badge>{panel.timeHorizon}</Badge> : null}
            {panel.tags.slice(0, 4).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          <h3 className="truncate text-base font-semibold text-neutral-50 md:text-lg">{panel.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-400">{panel.summary}</p>
        </div>
        <div className="hidden min-w-[220px] text-right md:block">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">{panel.regime}</div>
          <div className="mt-1 truncate text-sm tabular-nums text-neutral-200">
            {topMetric ? `${topMetric.config.label}: ${formatNumber(topMetric.stats.latest, topMetric.config.unit)}` : "news/methodology panel"}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">retrieved {freshnessLabel(panel.retrievedAt)}</div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden border-t border-neutral-800"
          >
            <div className="grid gap-3 p-3 md:p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-neutral-300">{panel.description}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-100">{panel.conclusion}</p>
                </div>
                <div className="grid gap-2 border border-neutral-800 bg-black p-3 text-xs text-neutral-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wide">Regime</span>
                    <span className="text-right text-neutral-100">{panel.regime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wide">Freshness</span>
                    <span className="text-neutral-100">{freshnessLabel(panel.retrievedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wide">Sources</span>
                    <span className="text-neutral-100">{panel.citations.length}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="secondary" onClick={(event) => { event.stopPropagation(); summarize(); }} disabled={aiLoading}>
                      <Bot className="h-4 w-4" />
                      {aiLoading ? "Summarizing" : "AI Summary"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={(event) => { event.stopPropagation(); onFavoriteToggle(panel.id); }}>
                      {favorite ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              {aiSummary ? <div className="border border-neutral-800 bg-black p-3 text-sm leading-6 text-neutral-200">{aiSummary}</div> : null}
              <MetricStrip metrics={panel.metrics} />
              <div className="grid gap-3 lg:grid-cols-3">
                {(["24h", "7d", "30d"] as const).map((windowKey) => (
                  <div key={windowKey} className="border border-neutral-800 bg-black p-3">
                    <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Changed {windowKey}</div>
                    {panel.whatChanged[windowKey].length ? (
                      <ul className="space-y-1 text-xs leading-5 text-neutral-300">
                        {panel.whatChanged[windowKey].map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-neutral-500">No comparable live observations.</p>
                    )}
                  </div>
                ))}
              </div>
              <ScenarioTree panel={panel} />
              <CorrelationBlock panel={panel} />
              {panel.actors.length || panel.catalysts.length ? (
                <div className="grid gap-px overflow-hidden border border-neutral-800 bg-neutral-800 md:grid-cols-2">
                  <div className="bg-[#080808] p-3">
                    <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Actors / constraints</div>
                    <div className="flex flex-wrap gap-1">
                      {panel.actors.map((actor) => (
                        <Badge key={actor}>{actor}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#080808] p-3">
                    <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Catalysts</div>
                    <div className="flex flex-wrap gap-1">
                      {panel.catalysts.map((catalyst) => (
                        <Badge key={catalyst}>{catalyst}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              <NewsBlock panel={panel} />
              <div className="grid gap-3">
                {panel.metrics.map((metric) => (
                  <MetricDetail key={metric.config.id} metric={metric} />
                ))}
              </div>
              {panel.methodology ? (
                <div className="border border-neutral-800 bg-black p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Methodology</div>
                  <p className="text-xs leading-5 text-neutral-300">{panel.methodology}</p>
                </div>
              ) : null}
              <div className="border border-neutral-800 bg-black p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Sources</div>
                <div className="grid gap-1">
                  {panel.citations.slice(0, 18).map((citation, index) => (
                    <a
                      key={`${citation.sourceUrl}-${index}`}
                      href={citation.humanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center justify-between gap-3 border border-transparent px-2 py-1 text-xs text-neutral-400 hover:border-neutral-800 hover:text-neutral-100"
                    >
                      <span className="min-w-0 truncate">{citation.title ?? citation.sourceName}</span>
                      <span className="shrink-0 text-[11px] uppercase tracking-wide">{freshnessLabel(citation.retrievedAt)}</span>
                    </a>
                  ))}
                </div>
              </div>
              {panel.children.length ? (
                <div className="grid gap-2 border-l border-neutral-800 pl-2 md:pl-4">
                  {panel.children.map((child) => (
                    <MacroPanel
                      key={child.id}
                      panel={child}
                      expanded={isExpanded(child.id)}
                      isExpanded={isExpanded}
                      onToggle={onToggle}
                      tab={tab}
                      depth={depth + 1}
                      isFavorite={isFavorite}
                      onFavoriteToggle={onFavoriteToggle}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}
