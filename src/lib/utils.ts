import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
