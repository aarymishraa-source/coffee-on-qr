// Ingredient demand forecast — pure, deterministic, unit-tested
// (tests/unit/forecast.test.ts). No I/O: callers pass sales, recipes and stock.
//
// Method (shown to users in "How this was calculated"):
//   1. Per dish, base rate = 14-day moving average of units sold per day.
//   2. Trend factor = 7-day average ÷ 14-day average, clamped to 0.90–1.10,
//      so one unusual week can move the forecast by at most ±10%.
//   3. Weekday index = average sales on that weekday ÷ overall daily average
//      over the last 28 days (weekends sell more).
//   4. Units on day d = base × trend × weekday index(d).
//   5. Ingredient need = Σ dishes (units × grams per serving) ÷ 1000.
//   6. Safety buffer = 10% for perishables, 5% otherwise.
//   7. Suggested purchase = max(0, need + buffer − stock), rounded up to 0.5.

export const FORECAST_METHOD = "ma14-trend-weekday-v1";
export const HISTORY_DAYS = 28;
export const TREND_CLAMP = [0.9, 1.1] as const;
export const SAFETY_PCT = { perishable: 0.1, other: 0.05 } as const;
export const PACK_SIZE = 0.5;

export interface DailySale {
  menuItemId: string;
  date: string; // YYYY-MM-DD
  units: number;
}

export interface ForecastInput {
  /** First forecast day, YYYY-MM-DD. History is the HISTORY_DAYS before it. */
  startDate: string;
  horizonDays?: number;
  sales: DailySale[];
  menuItems: { id: string; name: string; cafeName: string }[];
  recipes: { menuItemId: string; ingredientId: string; quantity: number }[];
  ingredients: { id: string; name: string; unit: string; perishable: boolean }[];
  stock: Record<string, number>;
}

export interface DishContribution {
  menuItemId: string;
  name: string;
  cafeName: string;
  ma14: number;
  ma7: number;
  trend: number;
  forecastUnits: number;
  perServing: number; // grams or ml
  quantity: number; // kg or l over the horizon
}

export interface IngredientForecast {
  ingredientId: string;
  name: string;
  unit: string;
  forecast: number;
  buffer: number;
  safetyPct: number;
  stock: number;
  suggested: number;
  daily: { date: string; quantity: number }[];
  history: { date: string; quantity: number }[];
  contributions: DishContribution[];
}

export interface ForecastResult {
  method: string;
  startDate: string;
  endDate: string;
  historyStart: string;
  historyEnd: string;
  ingredients: IngredientForecast[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function ceilTo(n: number, step: number): number {
  return Math.ceil(round3(n / step)) * step;
}

interface DishRate {
  ma14: number;
  ma7: number;
  trend: number;
  weekday: number[];
  history: number[]; // units per history day, oldest first
}

function dishRate(unitsByDate: Map<string, number>, historyDates: string[]): DishRate {
  const history = historyDates.map((d) => unitsByDate.get(d) ?? 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const ma14 = sum(history.slice(-14)) / 14;
  const ma7 = sum(history.slice(-7)) / 7;
  const trend =
    ma14 === 0 ? 1 : Math.min(TREND_CLAMP[1], Math.max(TREND_CLAMP[0], ma7 / ma14));

  const overall = sum(history) / history.length;
  const weekday = Array.from({ length: 7 }, (_, dow) => {
    const xs = history.filter((_, i) => dayOfWeek(historyDates[i]) === dow);
    if (overall === 0 || xs.length === 0) return 1;
    return sum(xs) / xs.length / overall;
  });
  return { ma14, ma7, trend, weekday, history };
}

export function computeForecast(input: ForecastInput): ForecastResult {
  const horizon = input.horizonDays ?? 7;
  const historyDates = Array.from({ length: HISTORY_DAYS }, (_, i) =>
    addDays(input.startDate, i - HISTORY_DAYS)
  );
  const futureDates = Array.from({ length: horizon }, (_, i) => addDays(input.startDate, i));

  const salesByItem = new Map<string, Map<string, number>>();
  for (const s of input.sales) {
    const m = salesByItem.get(s.menuItemId) ?? new Map<string, number>();
    m.set(s.date, (m.get(s.date) ?? 0) + s.units);
    salesByItem.set(s.menuItemId, m);
  }

  const rates = new Map<string, DishRate>();
  for (const item of input.menuItems) {
    rates.set(item.id, dishRate(salesByItem.get(item.id) ?? new Map(), historyDates));
  }
  const itemById = new Map(input.menuItems.map((m) => [m.id, m]));

  const ingredients: IngredientForecast[] = input.ingredients.map((ing) => {
    const lines = input.recipes.filter((r) => r.ingredientId === ing.id && itemById.has(r.menuItemId));
    const daily = futureDates.map((date) => ({ date, quantity: 0 }));
    const history = historyDates.map((date) => ({ date, quantity: 0 }));
    const contributions: DishContribution[] = [];

    for (const line of lines) {
      const item = itemById.get(line.menuItemId)!;
      const rate = rates.get(line.menuItemId)!;
      let units = 0;
      futureDates.forEach((date, i) => {
        const u = rate.ma14 * rate.trend * rate.weekday[dayOfWeek(date)];
        units += u;
        daily[i].quantity += (u * line.quantity) / 1000;
      });
      rate.history.forEach((u, i) => {
        history[i].quantity += (u * line.quantity) / 1000;
      });
      contributions.push({
        menuItemId: item.id,
        name: item.name,
        cafeName: item.cafeName,
        ma14: round2(rate.ma14),
        ma7: round2(rate.ma7),
        trend: round3(rate.trend),
        forecastUnits: round2(units),
        perServing: line.quantity,
        quantity: round3((units * line.quantity) / 1000),
      });
    }

    const forecast = daily.reduce((a, d) => a + d.quantity, 0);
    const safetyPct = ing.perishable ? SAFETY_PCT.perishable : SAFETY_PCT.other;
    const buffer = forecast * safetyPct;
    const stock = input.stock[ing.id] ?? 0;
    const suggested = ceilTo(Math.max(0, forecast + buffer - stock), PACK_SIZE);

    return {
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      forecast: round2(forecast),
      buffer: round2(buffer),
      safetyPct,
      stock: round2(stock),
      suggested,
      daily: daily.map((d) => ({ date: d.date, quantity: round2(d.quantity) })),
      history: history.map((d) => ({ date: d.date, quantity: round2(d.quantity) })),
      contributions: contributions.sort((a, b) => b.quantity - a.quantity),
    };
  });

  return {
    method: FORECAST_METHOD,
    startDate: input.startDate,
    endDate: futureDates[futureDates.length - 1],
    historyStart: historyDates[0],
    historyEnd: historyDates[historyDates.length - 1],
    ingredients,
  };
}

/** Position of on-hand stock + committed supply against need for the horizon. */
export function supplyPosition(f: Pick<IngredientForecast, "forecast" | "buffer" | "stock">, committed: number) {
  return round2(f.stock + committed - (f.forecast + f.buffer));
}
