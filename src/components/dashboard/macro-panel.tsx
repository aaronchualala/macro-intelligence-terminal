"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Newspaper
} from "lucide-react";

import { CorrelationChart } from "@/components/dashboard/charts";
import { MetricTable } from "@/components/dashboard/metric-grid";
import { Badge } from "@/components/ui/badge";
import type { PanelSnapshot } from "@/lib/types";
import { freshnessLabel } from "@/lib/utils";

function dataAvailabilityLabel(confidence: string) {
  const normalized = confidence.charAt(0).toUpperCase() + confidence.slice(1);
  return `${normalized} Data Availability`;
}

function importanceScore(importance: number) {
  return (importance / 10).toFixed(1);
}

function importanceExplanation(panel: PanelSnapshot) {
  return `Current importance is ${importanceScore(panel.importance)} / 10 because ${panel.title} has a configured near-term market relevance score of ${panel.importance}/100, based on decision urgency, cross-asset sensitivity, and usefulness for the current dashboard regime.`;
}

function dataAvailabilityExplanation(panel: PanelSnapshot) {
  const available = panel.metrics.filter((metric) => metric.confidence !== "unavailable").length;
  const total = panel.metrics.length;
  const basis = total ? `${available} of ${total} tracked series currently have usable observations` : `${panel.news.length} recent source items are available`;
  return `${dataAvailabilityLabel(panel.confidence)} is assigned because ${basis}. The rating rises as more source-backed series/news items are fresh and falls when data is missing, stale, or source requests fail.`;
}

function regimeExplanation(panel: PanelSnapshot) {
  const method = panel.methodology ? ` Methodology: ${panel.methodology}` : "";
  return `Regime is ${panel.regime}. The dashboard derives this by applying the panel methodology to current z-scores, percentile ranks, direction of change, and stress/easing polarity across the available series.${method}`;
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
            <p className="mt-2 text-xs leading-5 text-neutral-400">{scenario.marketPath}</p>
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
  depth = 0
}: {
  panel: PanelSnapshot;
  expanded: boolean;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  tab: string;
  depth?: number;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-sm border border-neutral-800/90 bg-[#080808] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_42px_rgba(0,0,0,0.32)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-neutral-600 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.035),0_22px_54px_rgba(0,0,0,0.38)] ${
        depth ? "bg-[#070707]" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-neutral-400/45" />
      <button
        type="button"
        onClick={() => onToggle(panel.id)}
        aria-expanded={expanded}
        className="group grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 text-left transition hover:bg-[#0d0d0d] md:grid-cols-[auto_minmax(0,1fr)_230px] md:p-5"
      >
        <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-sm border border-neutral-800 bg-black text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_20px_rgba(0,0,0,0.24)] transition group-hover:border-neutral-500 group-hover:text-neutral-100">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-5 items-center rounded-[2px] border border-neutral-800 bg-black px-1.5 text-[11px] leading-none text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
              title={importanceExplanation(panel)}
            >
              Current Importance {importanceScore(panel.importance)} / 10
            </span>
            <span
              className="inline-flex h-5 max-w-full items-center rounded-[2px] border border-neutral-800 bg-neutral-950 px-1.5 text-[10px] font-medium uppercase leading-none tracking-wide text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              title={regimeExplanation(panel)}
            >
              Regime {panel.regime}
            </span>
            {panel.timeHorizon ? <Badge>{panel.timeHorizon}</Badge> : null}
            {panel.tags.slice(0, 4).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          <h3 className="truncate text-base font-semibold text-neutral-400 md:text-lg">{panel.title}</h3>
          <p className="mt-1 line-clamp-3 text-sm leading-5 text-neutral-400">
            {panel.summary}
            {panel.description ? <span> {panel.description}</span> : null}
          </p>
          <div className="mt-3 rounded-r-sm border-l border-neutral-700 bg-black/25 py-2 pl-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.018)]">
            {panel.methodology ? (
              <p className={`text-[11px] leading-5 text-neutral-400 ${expanded ? "" : "line-clamp-2"}`}>
                <span className="uppercase tracking-wide text-neutral-400">Methodology </span>
                {panel.methodology}
              </p>
            ) : null}
          </div>
        </div>
        <div className="col-span-2 min-w-[190px] self-center text-left md:col-span-1 md:text-right">
          <div className="mb-2 flex md:justify-end">
            <Badge className="normal-case text-[11px] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]" title={dataAvailabilityExplanation(panel)}>
              {dataAvailabilityLabel(panel.confidence)}
            </Badge>
          </div>
          <div className="text-sm tabular-nums text-neutral-400">{panel.citations.length} sources</div>
          <div className="mt-1 text-[11px] text-neutral-400">retrieved {freshnessLabel(panel.retrievedAt)}</div>
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
            <div className="grid gap-3 bg-[#050505]/70 p-3 md:p-4">
              <MetricTable metrics={panel.metrics} />
              <ScenarioTree panel={panel} />
              <CorrelationBlock panel={panel} />
              {panel.actors.length || panel.catalysts.length ? (
                <div className="grid gap-px overflow-hidden rounded-sm border border-neutral-800 bg-neutral-800 md:grid-cols-2">
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
