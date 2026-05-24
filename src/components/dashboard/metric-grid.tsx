"use client";

import { ExternalLink } from "lucide-react";

import type { Observation, SeriesResult } from "@/lib/types";
import { formatDate, formatMetricNumber, formatNumber, freshnessLabel } from "@/lib/utils";

function Sparkline({
  observations,
  direction
}: {
  observations: Observation[];
  direction?: string;
}) {
  const points = observations.slice(-96).filter((item) => Number.isFinite(item.value));
  if (points.length < 2) {
    return <div className="h-8 w-32 border border-neutral-900 bg-black" aria-label="Insufficient history" />;
  }

  const width = 128;
  const height = 32;
  const values = points.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const d = points
    .map((item, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((item.value - min) / range) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const last = points.at(-1);
  const first = points[0];
  const stroke =
    direction === "up" ? "#86efac" :
    direction === "down" ? "#fca5a5" :
    "#d4d4d4";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-32 overflow-visible" role="img" aria-label="Recent sparkline">
      <path d={`M0 ${height - 1}H${width}`} stroke="#171717" strokeWidth="1" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {last ? (
        <circle
          cx={width}
          cy={height - ((last.value - min) / range) * (height - 4) - 2}
          r="2"
          fill={stroke}
        />
      ) : null}
      <title>
        {first?.date ?? "n/a"} to {last?.date ?? "n/a"}
      </title>
    </svg>
  );
}

function changeUnit(metric: SeriesResult) {
  return metric.config.transform === "rate" || metric.config.transform === "spread" ? metric.config.unit : "percent";
}

function csvHref(metric: SeriesResult) {
  const rawCsv = [
    "date,value",
    ...metric.observations.map((item) => `${item.date},${item.value}`)
  ].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(rawCsv)}`;
}

export function MetricTable({ metrics }: { metrics: SeriesResult[] }) {
  if (!metrics.length) return null;

  return (
    <div className="overflow-hidden border border-neutral-800 bg-black">
      <div className="terminal-scrollbar overflow-x-auto">
        <table className="min-w-[1180px] w-full border-collapse text-left text-xs">
          <thead className="bg-[#090909] text-[10px] uppercase tracking-wide text-neutral-500">
            <tr className="[&>th]:border-b [&>th]:border-neutral-800 [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th className="w-[220px]">Series</th>
              <th className="w-[150px]">Sparkline</th>
              <th>Latest</th>
              <th>Latest Date</th>
              <th>Prior</th>
              <th>MoM</th>
              <th>YoY</th>
              <th>3m Ann.</th>
              <th>Percentile</th>
              <th>Z-score</th>
              <th>Regime</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {metrics.map((metric) => {
              const unit = changeUnit(metric);
              return (
                <tr key={metric.config.id} className="bg-[#050505] align-middle text-neutral-200 hover:bg-[#0b0b0b]">
                  <td className="max-w-[220px] px-3 py-2">
                    <div className="truncate font-medium text-neutral-100" title={metric.config.description}>
                      {metric.config.label}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-neutral-500">{metric.config.frequency}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Sparkline observations={metric.observations} direction={metric.stats.direction} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums text-neutral-50">{formatMetricNumber(metric)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-300">{formatDate(metric.stats.latestDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatMetricNumber(metric, metric.stats.prior)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatNumber(metric.stats.mom, unit)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatNumber(metric.stats.yoy, unit)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatNumber(metric.stats.threeMonthAnnualized, unit)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {metric.stats.percentile === undefined ? "n/a" : metric.stats.percentile.toFixed(0)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {metric.stats.zScore === undefined ? "n/a" : metric.stats.zScore.toFixed(2)}
                  </td>
                  <td className="max-w-[190px] px-3 py-2">
                    <span className="block truncate text-neutral-300">{metric.stats.regime ?? "n/a"}</span>
                    {metric.error ? <span className="block truncate text-[11px] text-red-300">{metric.error}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={metric.citation.humanUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-neutral-200 hover:text-white"
                      >
                        {metric.citation.sourceName}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        download={`${metric.config.id.replaceAll(":", "_")}.csv`}
                        href={csvHref(metric)}
                        className="border border-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400 hover:border-neutral-600 hover:text-neutral-100"
                      >
                        CSV
                      </a>
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">retrieved {freshnessLabel(metric.citation.retrievedAt)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
