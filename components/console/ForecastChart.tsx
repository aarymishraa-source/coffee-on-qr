"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { FORECAST_VS_ACTUAL } from "@/lib/seed";

const data = FORECAST_VS_ACTUAL.days.map((day, i) => ({
  day,
  forecast: FORECAST_VS_ACTUAL.forecast[i],
  actual: FORECAST_VS_ACTUAL.actual[i],
}));

export function ForecastChart() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="mono-label text-oat/60">This week · forecast vs actual unsold</h3>
        <div className="flex items-center gap-3 text-xs text-oat/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-forest" /> Forecast
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-matcha" /> Actual
          </span>
        </div>
      </div>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#FBFAF5", fillOpacity: 0.5 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(251,250,245,0.06)" }}
              contentStyle={{ fontSize: 12, borderRadius: 8, background: "#18211A", border: "1px solid rgba(251,250,245,0.15)", color: "#FBFAF5" }}
            />
            <Bar dataKey="forecast" fill="#2E4A2C" radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" fill="#A8C47A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
