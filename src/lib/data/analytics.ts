import type { Observation, SeriesConfig, SeriesStats } from "@/lib/types";

function pctChange(current?: number, prior?: number) {
  if (current === undefined || prior === undefined || prior === 0) return undefined;
  return ((current / prior) - 1) * 100;
}

function difference(current?: number, prior?: number) {
  if (current === undefined || prior === undefined) return undefined;
  return current - prior;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values: number[]) {
  if (values.length < 2) return undefined;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function percentile(values: number[], latest: number) {
  if (values.length < 10) return undefined;
  const below = values.filter((value) => value <= latest).length;
  return (below / values.length) * 100;
}

function findPriorByDays(observations: Observation[], days: number) {
  const latest = observations.at(-1);
  if (!latest) return undefined;
  const target = new Date(latest.date).getTime() - days * 24 * 3600 * 1000;
  return [...observations].reverse().find((item) => new Date(item.date).getTime() <= target);
}

function findPriorByMonths(observations: Observation[], months: number) {
  const latest = observations.at(-1);
  if (!latest) return undefined;
  const targetDate = new Date(latest.date);
  targetDate.setMonth(targetDate.getMonth() - months);
  return [...observations].reverse().find((item) => new Date(item.date).getTime() <= targetDate.getTime());
}

function rateOfChange(config: SeriesConfig, current?: number, prior?: number) {
  if (current === undefined || prior === undefined) return undefined;
  if (config.transform === "rate" || config.transform === "spread") return difference(current, prior);
  return pctChange(current, prior);
}

function annualized3m(config: SeriesConfig, current?: number, prior3m?: number) {
  if (current === undefined || prior3m === undefined) return undefined;
  if (config.transform === "rate" || config.transform === "spread") return (current - prior3m) * 4;
  if (prior3m === 0) return undefined;
  return ((current / prior3m) ** 4 - 1) * 100;
}

function classify(config: SeriesConfig, stats: Pick<SeriesStats, "zScore" | "yoy" | "threeMonthAnnualized" | "latest">) {
  if (stats.latest === undefined) return "unavailable";
  const hot = (stats.zScore ?? 0) > 1 || (stats.threeMonthAnnualized ?? 0) > (stats.yoy ?? 0) + 1;
  const cold = (stats.zScore ?? 0) < -1 || (stats.threeMonthAnnualized ?? 0) < (stats.yoy ?? 0) - 1;
  if (config.polarity === "higher_is_tighter") {
    if (hot) return "tightening/stress";
    if (cold) return "easing/relief";
  }
  if (config.polarity === "higher_is_easier") {
    if (hot) return "easier/liquid";
    if (cold) return "tighter/draining";
  }
  if (config.polarity === "higher_is_hotter") {
    if (hot) return "hot/accelerating";
    if (cold) return "cooling";
  }
  if (hot) return "above-trend";
  if (cold) return "below-trend";
  return "neutral";
}

export function computeStats(config: SeriesConfig, observations: Observation[]): SeriesStats {
  const sorted = observations
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  const prior = sorted.at(-2);
  const oneDay = findPriorByDays(sorted, 1);
  const sevenDay = findPriorByDays(sorted, 7);
  const thirtyDay = findPriorByDays(sorted, 30);
  const oneMonth = findPriorByMonths(sorted, 1);
  const threeMonths = findPriorByMonths(sorted, 3);
  const twelveMonths = findPriorByMonths(sorted, 12);
  const values = sorted.map((item) => item.value);
  const avg = values.length ? mean(values) : undefined;
  const sigma = values.length ? std(values) : undefined;
  const zScore = latest && avg !== undefined && sigma && sigma > 0 ? (latest.value - avg) / sigma : undefined;
  const stats: SeriesStats = {
    latest: latest?.value,
    latestDate: latest?.date,
    prior: prior?.value,
    priorDate: prior?.date,
    oneDayChange: rateOfChange(config, latest?.value, oneDay?.value),
    sevenDayChange: rateOfChange(config, latest?.value, sevenDay?.value),
    thirtyDayChange: rateOfChange(config, latest?.value, thirtyDay?.value),
    mom: rateOfChange(config, latest?.value, oneMonth?.value),
    yoy: rateOfChange(config, latest?.value, twelveMonths?.value),
    threeMonthAnnualized: annualized3m(config, latest?.value, threeMonths?.value),
    percentile: latest ? percentile(values, latest.value) : undefined,
    zScore,
    direction:
      latest?.value === undefined || prior?.value === undefined
        ? "unavailable"
        : Math.abs(latest.value - prior.value) < 1e-9
          ? "flat"
          : latest.value > prior.value
            ? "up"
            : "down"
  };
  stats.regime = classify(config, stats);
  return stats;
}

export function dailyReturnSeries(observations: Observation[], mode: "diff" | "log" = "log") {
  const sorted = observations.sort((a, b) => a.date.localeCompare(b.date));
  const returns: Observation[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const prior = sorted[index - 1];
    if (prior.value === 0) continue;
    returns.push({
      date: current.date,
      value: mode === "diff" ? current.value - prior.value : Math.log(current.value / prior.value)
    });
  }
  return returns;
}

export function rollingCorrelation(left: Observation[], right: Observation[], window = 63): Observation[] {
  const rightMap = new Map(right.map((item) => [item.date, item.value]));
  const aligned = left
    .filter((item) => rightMap.has(item.date))
    .map((item) => ({ date: item.date, left: item.value, right: rightMap.get(item.date)! }));
  const output: Observation[] = [];
  for (let index = window - 1; index < aligned.length; index += 1) {
    const slice = aligned.slice(index - window + 1, index + 1);
    const l = slice.map((item) => item.left);
    const r = slice.map((item) => item.right);
    const ml = mean(l);
    const mr = mean(r);
    const numerator = mean(slice.map((item) => (item.left - ml) * (item.right - mr)));
    const denom = (std(l) ?? 0) * (std(r) ?? 0);
    if (denom > 0) output.push({ date: aligned[index].date, value: numerator / denom });
  }
  return output;
}

export function latestCorrelationSummary(series: { label: string; observations: Observation[]; transform: SeriesConfig["transform"] }[]) {
  const returns = series.map((item) => ({
    label: item.label,
    observations: dailyReturnSeries(item.observations, item.transform === "rate" || item.transform === "spread" ? "diff" : "log")
  }));
  const pairs = [];
  for (let left = 0; left < returns.length; left += 1) {
    for (let right = left + 1; right < returns.length; right += 1) {
      const rolling = rollingCorrelation(returns[left].observations, returns[right].observations, 63);
      const latest = rolling.at(-1);
      if (latest) {
        pairs.push({
          pair: `${returns[left].label} / ${returns[right].label}`,
          value: latest.value,
          date: latest.date,
          observations: rolling.slice(-252)
        });
      }
    }
  }
  return pairs.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}
