// Thermal Debt — cumulative time-temperature exposure per batch.
// See CLAUDE.md §7 "Thermal Debt" for the model this implements.

export const THERMAL_LIMIT_C = 5;
export const THERMAL_BUDGET_C_MIN = 120; // °C·min
export const STALE_READING_MINUTES = 30;

export type ThermalStatus = "within" | "warning" | "blocked" | "unknown";

export interface TempReading {
  at: Date;
  temp: number;
}

export interface ThermalResult {
  debt: number; // °C·min, cumulative
  pct: number; // debt / budget, can exceed 1
  status: ThermalStatus;
  /** minutes left in the eligible sale window, or null when unknown */
  windowLeftMinutes: number | null;
  currentTemp: number | null;
  lastReadingAt: Date | null;
}

/**
 * Cumulative exposure above the limit, in °C·min.
 * Each reading (after the first) contributes its excess-over-limit
 * temperature times the minutes elapsed since the previous reading —
 * this is what makes a batch's history matter, not just its latest reading.
 */
export function computeDebt(readings: TempReading[], limit = THERMAL_LIMIT_C): number {
  if (readings.length < 2) return 0;
  const sorted = [...readings].sort((a, b) => a.at.getTime() - b.at.getTime());
  let debt = 0;
  for (let i = 1; i < sorted.length; i++) {
    const minutes = (sorted[i].at.getTime() - sorted[i - 1].at.getTime()) / 60000;
    const excess = Math.max(0, sorted[i].temp - limit);
    debt += excess * minutes;
  }
  return debt;
}

export interface ThermalOptions {
  limit?: number;
  budget?: number;
  staleMinutes?: number;
}

export function computeThermal(
  readings: TempReading[],
  saleWindowEnd: Date,
  now: Date,
  opts: ThermalOptions = {}
): ThermalResult {
  const limit = opts.limit ?? THERMAL_LIMIT_C;
  const budget = opts.budget ?? THERMAL_BUDGET_C_MIN;
  const staleMinutes = opts.staleMinutes ?? STALE_READING_MINUTES;

  const sorted = [...readings].sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const minutesSinceLast = last ? (now.getTime() - last.at.getTime()) / 60000 : Infinity;

  const debt = computeDebt(sorted, limit);
  const pct = debt / budget;

  // Sensor outages are flagged Unknown — never green — and that check
  // comes before everything else.
  let status: ThermalStatus;
  if (!last || minutesSinceLast > staleMinutes) {
    status = "unknown";
  } else if (pct >= 1 || now.getTime() >= saleWindowEnd.getTime()) {
    status = "blocked";
  } else if (pct >= 0.7) {
    status = "warning";
  } else {
    status = "within";
  }

  let windowLeftMinutes: number | null;
  if (status === "unknown") {
    windowLeftMinutes = null;
  } else {
    const untilWindowEnd = (saleWindowEnd.getTime() - now.getTime()) / 60000;
    const currentTemp = last ? last.temp : null;
    const debtLimited =
      currentTemp !== null && currentTemp > limit
        ? (budget - debt) / (currentTemp - limit)
        : Infinity;
    windowLeftMinutes = Math.max(0, Math.min(untilWindowEnd, debtLimited));
  }

  return {
    debt,
    pct,
    status,
    windowLeftMinutes,
    currentTemp: last ? last.temp : null,
    lastReadingAt: last ? last.at : null,
  };
}

/** Only a batch in "within" status may ever be offered — see CLAUDE.md §9 rule 2. */
export function isOfferable(status: ThermalStatus): boolean {
  return status === "within";
}
