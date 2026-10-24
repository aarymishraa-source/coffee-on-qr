"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qty, rupees, shortDate, weekday } from "@/lib/formatters";
import type { SupplyRow } from "../types";

const INK = "#6B6F66";
const GRID = "#E4E0D3";
const PRIMARY = "#2E4A2C";
const FORECAST = "#A8C47A";

function TooltipBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{title}</p>
      {lines.map((l) => (
        <p key={l} className="tabular text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  );
}

/** Café orders per day across all outlets — the input the forecast is built on. */
export function OrdersTrendChart({ data }: { data: { date: string; orders: number; revenue: number }[] }) {
  return (
    <div className="h-40" role="img" aria-label={`Café orders per day, ${data.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.14} />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="0" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} interval={6} />
          <YAxis tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ stroke: INK, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { date: string; orders: number; revenue: number } | undefined;
              return active && p ? <TooltipBox title={`${weekday(p.date)} ${shortDate(p.date)}`} lines={[`${p.orders} orders`, rupees(p.revenue)]} /> : null;
            }}
          />
          <Area type="monotone" dataKey="orders" stroke={PRIMARY} strokeWidth={2} fill="url(#ordersFill)" isAnimationActive animationDuration={250} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily usage of one ingredient: last 28 days (actual) then the 7-day forecast. */
export function UsageChart({ row }: { row: SupplyRow }) {
  const data = [
    ...row.history.map((h) => ({ ...h, kind: "Used" as const })),
    ...row.daily.map((d) => ({ ...d, kind: "Forecast" as const })),
  ];
  return (
    <div>
      <div className="h-40" role="img" aria-label={`${row.name} usage per day for 28 days and forecast for 7 days`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} interval={6} />
            <YAxis tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              cursor={{ fill: "#F3F1EA" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as { date: string; quantity: number; kind: string } | undefined;
                return active && p ? (
                  <TooltipBox title={`${weekday(p.date)} ${shortDate(p.date)}`} lines={[`${p.kind}: ${qty(p.quantity, row.unit)}`]} />
                ) : null;
              }}
            />
            <Bar dataKey="quantity" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={250}>
              {data.map((d) => (
                <Cell key={d.date} fill={d.kind === "Forecast" ? FORECAST : PRIMARY} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" /> Used (from café orders)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-matcha" aria-hidden="true" /> Forecast (estimate)
        </span>
      </div>
    </div>
  );
}
