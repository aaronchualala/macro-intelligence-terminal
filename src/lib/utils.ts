import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { SeriesConfig, SeriesResult } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value?: number, unit = "", digits = 2) {
  if (value === undefined || Number.isNaN(value)) return "n/a";
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 1 : abs >= 10 ? Math.min(digits, 2) : digits;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: abs < 10 && abs !== 0 ? Math.min(1, decimals) : 0
  }).format(value);
  return unit === "percent" ? `${formatted}%` : unit === "bps" ? `${formatted} bps` : `${formatted}${unit ? ` ${unit}` : ""}`;
}

export function metricDisplayUnit(config: Pick<SeriesConfig, "unit" | "marketSymbol">) {
  if (config.unit !== "index/price") return config.unit;
  const symbol = config.marketSymbol ?? "";
  if (symbol.startsWith("^")) return "index pts";
  if (symbol.endsWith("=X")) return "FX rate";
  if (symbol.endsWith("-USD")) return "USD";
  return "USD/share";
}

export function formatMetricNumber(metric: SeriesResult, value = metric.stats.latest) {
  return formatNumber(value, metricDisplayUnit(metric.config));
}

export function formatDate(value?: string) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function freshnessLabel(value?: string) {
  if (!value) return "not retrieved";
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function hashString(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}
