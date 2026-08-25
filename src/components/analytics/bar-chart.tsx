"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Single-measure bar chart (identity = the x category; color = one hue).
 * Thin bars, rounded data ends, recessive grid, hover tooltip.
 */
export function CategoryBarChart({
  data,
  colorVar = "--chart-1",
  unit = "%",
  yMax,
}: {
  data: BarDatum[];
  colorVar?: string;
  unit?: string;
  yMax?: number;
}) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Not enough data yet
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%">
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
          interval={0}
          angle={data.length > 5 ? -24 : 0}
          height={data.length > 5 ? 56 : 30}
          textAnchor={data.length > 5 ? "end" : "middle"}
        />
        <YAxis
          domain={[0, yMax ?? "auto"]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={48}
          unit={unit}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value) => [`${value as number}${unit}`, ""]}
        />
        <Bar
          dataKey="value"
          fill={`var(${colorVar})`}
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
