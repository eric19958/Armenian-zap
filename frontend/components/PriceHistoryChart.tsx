"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatAMD,
  formatAMDShort,
  retailerColor,
  retailerLabel,
} from "@/lib/format";
import type { PriceHistoryPoint } from "@/lib/types";

/**
 * Multi-line price history. Pivots the tidy (retailer, date, price) rows into
 * one row per day with a column per retailer, then draws a line each, using the
 * shared retailer brand colors.
 */
export default function PriceHistoryChart({
  points,
}: {
  points: PriceHistoryPoint[];
}) {
  const { data, retailers } = useMemo(() => {
    const retailerSet = new Set<string>();
    const byDate = new Map<string, Record<string, number | string>>();

    for (const p of points) {
      const day = p.observed_at.slice(0, 10); // YYYY-MM-DD
      retailerSet.add(p.retailer_slug);
      const row = byDate.get(day) ?? { date: day };
      row[p.retailer_slug] = Number(p.price);
      byDate.set(day, row);
    }

    const rows = [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
    return { data: rows, retailers: [...retailerSet] };
  }, [points]);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-400">
        No price history recorded yet — check back after the next daily run.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            tickFormatter={(v: number) => formatAMDShort(v)}
            tickLine={false}
            axisLine={false}
            width={72}
            domain={["dataMin - 30000", "dataMax + 30000"]}
          />
          <Tooltip
            formatter={(value: any, name: any) => [
              formatAMD(Number(value)),
              retailerLabel(String(name)),
            ]}
            labelFormatter={(d: any) =>
              new Date(d as string).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            }
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 13,
            }}
          />
          <Legend formatter={(value: string) => retailerLabel(value)} />
          {retailers.map((slug) => (
            <Line
              key={slug}
              type="monotone"
              dataKey={slug}
              name={slug}
              stroke={retailerColor(slug)}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
