"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine
} from "recharts";

import type { Observation } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function TimeSeriesChart({
  data,
  unit,
  height = 220
}: {
  data: Observation[];
  unit?: string;
  height?: number;
}) {
  const points = data.slice(-260).map((item) => ({
    date: item.date,
    value: item.value
  }));
  if (points.length < 2) {
    return (
      <div className="flex h-[180px] items-center justify-center border border-neutral-800 bg-black text-xs uppercase tracking-wide text-neutral-500">
        Insufficient live history
      </div>
    );
  }
  return (
    <div style={{ height }} className="w-full border border-neutral-800 bg-black p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1f1f1f" vertical={false} />
          <XAxis dataKey="date" minTickGap={32} tick={{ fill: "#a3a3a3", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#333" }} />
          <YAxis
            width={56}
            tick={{ fill: "#a3a3a3", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#333" }}
            tickFormatter={(value) => formatNumber(Number(value), unit, 1)}
          />
          <Tooltip
            contentStyle={{ background: "#050505", border: "1px solid #404040", borderRadius: 0, color: "#f5f5f5", fontSize: 12 }}
            labelStyle={{ color: "#d4d4d4" }}
            formatter={(value) => [formatNumber(Number(value), unit), "value"]}
          />
          <Line type="monotone" dataKey="value" stroke="#f5f5f5" strokeWidth={1.4} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CorrelationChart({ data }: { data: Observation[] }) {
  const points = data.slice(-180);
  if (points.length < 2) return null;
  return (
    <div className="h-[160px] w-full border border-neutral-800 bg-black p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1f1f1f" vertical={false} />
          <ReferenceLine y={0} stroke="#525252" strokeDasharray="3 3" />
          <XAxis dataKey="date" minTickGap={32} tick={{ fill: "#a3a3a3", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#333" }} />
          <YAxis domain={[-1, 1]} width={36} tick={{ fill: "#a3a3a3", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#333" }} />
          <Tooltip
            contentStyle={{ background: "#050505", border: "1px solid #404040", borderRadius: 0, color: "#f5f5f5", fontSize: 12 }}
            formatter={(value) => [Number(value).toFixed(2), "corr"]}
          />
          <Line type="monotone" dataKey="value" stroke="#d4d4d4" strokeWidth={1.3} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
