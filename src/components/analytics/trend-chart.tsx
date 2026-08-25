"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendDatum {
  /** Short x label, e.g. "12 Aug" or "#3". */
  label: string;
  value: number;
}

/**
 * Single-series line chart for score/accuracy trends.
 * Color follows the entity via CSS chart tokens; single series → no legend
 * (the card title names it). Recessive grid, 2px line, dot+tooltip on hover.
 */
export function TrendChart({
  data,
  colorVar = "--chart-1",
  yDomain = [0, 100],
  unit = "%",
}: {
  data: TrendDatum[];
  colorVar?: string;
  yDomain?: [number, number];
  unit?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Not enough data yet
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--border)"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={yDomain}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={48}
          unit={unit}
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value) => [`${value as number}${unit}`, ""]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={`var(${colorVar})`}
          strokeWidth={2}
          dot={{ r: 3.5, fill: `var(${colorVar})`, strokeWidth: 2, stroke: "var(--card)" }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
