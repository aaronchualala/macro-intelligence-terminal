"use client";

import { ArrowDown, ArrowRight, ArrowUp, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TimeSeriesChart } from "@/components/dashboard/charts";
import type { SeriesResult } from "@/lib/types";
import { formatDate, formatNumber, freshnessLabel } from "@/lib/utils";

function DirectionIcon({ direction }: { direction?: string }) {
  if (direction === "up") return <ArrowUp className="h-3.5 w-3.5" />;
  if (direction === "down") return <ArrowDown className="h-3.5 w-3.5" />;
  return <ArrowRight className="h-3.5 w-3.5" />;
}

export function MetricStrip({ metrics }: { metrics: SeriesResult[] }) {
  return (
    <div className="grid gap-px overflow-hidden border border-neutral-800 bg-neutral-800 md:grid-cols-2 xl:grid-cols-4">
      {metrics.slice(0, 8).map((metric) => (
        <a
          key={metric.config.id}
          href={metric.citation.humanUrl}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 bg-[#080808] p-3 transition hover:bg-neutral-950"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0 text-[11px] uppercase tracking-wide text-neutral-400">{metric.config.label}</div>
            <DirectionIcon direction={metric.stats.direction} />
          </div>
          <div className="truncate text-lg font-semibold tabular-nums text-neutral-50">
            {formatNumber(metric.stats.latest, metric.config.unit)}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-neutral-500">
            <span>{formatDate(metric.stats.latestDate)}</span>
            <span>retrieved {freshnessLabel(metric.citation.retrievedAt)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge tone={metric.confidence === "high" ? "good" : metric.confidence === "unavailable" ? "risk" : "warn"}>
              {metric.confidence}
            </Badge>
            {metric.stats.percentile !== undefined ? <Badge>pctl {metric.stats.percentile.toFixed(0)}</Badge> : null}
            {metric.stats.zScore !== undefined ? <Badge>z {metric.stats.zScore.toFixed(1)}</Badge> : null}
          </div>
        </a>
      ))}
    </div>
  );
}

export function MetricDetail({ metric }: { metric: SeriesResult }) {
  const rawCsv = [
    "date,value",
    ...metric.observations.map((item) => `${item.date},${item.value}`)
  ].join("\n");
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(rawCsv)}`;
  return (
    <div className="grid gap-3 border border-neutral-800 bg-[#050505] p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-neutral-100">{metric.config.label}</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-400">{metric.config.description}</p>
          </div>
          <a
            className="inline-flex items-center gap-1 border border-neutral-800 px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-300 hover:border-neutral-500"
            href={metric.citation.humanUrl}
            target="_blank"
            rel="noreferrer"
          >
            Source
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <TimeSeriesChart data={metric.observations} unit={metric.config.unit} />
      </div>
      <div className="grid content-start gap-px overflow-hidden border border-neutral-800 bg-neutral-800 text-xs">
        {[
          ["Latest", formatNumber(metric.stats.latest, metric.config.unit)],
          ["Latest date", formatDate(metric.stats.latestDate)],
          ["Prior", formatNumber(metric.stats.prior, metric.config.unit)],
          ["MoM", formatNumber(metric.stats.mom, metric.config.transform === "rate" || metric.config.transform === "spread" ? metric.config.unit : "percent")],
          ["YoY", formatNumber(metric.stats.yoy, metric.config.transform === "rate" || metric.config.transform === "spread" ? metric.config.unit : "percent")],
          ["3m ann.", formatNumber(metric.stats.threeMonthAnnualized, metric.config.transform === "rate" || metric.config.transform === "spread" ? metric.config.unit : "percent")],
          ["Percentile", metric.stats.percentile === undefined ? "n/a" : metric.stats.percentile.toFixed(0)],
          ["Z-score", metric.stats.zScore === undefined ? "n/a" : metric.stats.zScore.toFixed(2)],
          ["Regime", metric.stats.regime ?? "n/a"],
          ["Retrieved", freshnessLabel(metric.citation.retrievedAt)]
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] bg-[#080808]">
            <span className="px-2 py-2 uppercase tracking-wide text-neutral-500">{label}</span>
            <span className="min-w-0 break-words px-2 py-2 text-neutral-200">{value}</span>
          </div>
        ))}
        <a
          download={`${metric.config.id.replaceAll(":", "_")}.csv`}
          href={csvHref}
          className="bg-[#080808] px-2 py-2 text-[11px] uppercase tracking-wide text-neutral-300 hover:bg-neutral-950"
        >
          Download raw series CSV
        </a>
      </div>
      {metric.error ? <p className="lg:col-span-2 text-xs text-red-300">{metric.error}</p> : null}
    </div>
  );
}
