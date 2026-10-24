import { describe, expect, test } from "vitest";
import { addDays, ceilTo, computeForecast, supplyPosition } from "@/server/services/forecast.service";

// Hand-checkable inputs: one dish, flat sales of 10/day, 50 g basil per serving.
function flatSales(units: number, start = "2026-10-25") {
  return Array.from({ length: 28 }, (_, i) => ({ menuItemId: "soup", date: addDays(start, i - 28), units }));
}

const base = {
  startDate: "2026-10-25",
  menuItems: [{ id: "soup", name: "Soup", cafeName: "Café A" }],
  recipes: [{ menuItemId: "soup", ingredientId: "basil", quantity: 50 }],
  ingredients: [{ id: "basil", name: "Basil", unit: "kg", perishable: true }],
};

describe("computeForecast", () => {
  test("flat sales: 10/day × 50 g × 7 days = 3.5 kg, +10% buffer, − stock, rounded up to 0.5", () => {
    const r = computeForecast({ ...base, sales: flatSales(10), stock: { basil: 1 } });
    const b = r.ingredients[0];
    expect(b.forecast).toBe(3.5);
    expect(b.buffer).toBe(0.35);
    expect(b.suggested).toBe(3); // 3.5 + 0.35 − 1 = 2.85 → 3
    expect(b.contributions[0]).toMatchObject({ ma14: 10, ma7: 10, trend: 1, forecastUnits: 70, quantity: 3.5 });
    expect(r.startDate).toBe("2026-10-25");
    expect(r.endDate).toBe("2026-10-31");
    expect(b.history).toHaveLength(28);
  });

  test("never suggests a negative purchase", () => {
    const r = computeForecast({ ...base, sales: flatSales(10), stock: { basil: 50 } });
    expect(r.ingredients[0].suggested).toBe(0);
  });

  test("trend is clamped to ±10%", () => {
    // Last 7 days at 20/day, previous 21 at 10/day → ma7/ma14 = 20/15 = 1.33 → clamp 1.1
    const sales = flatSales(10).map((s, i) => (i >= 21 ? { ...s, units: 20 } : s));
    const c = computeForecast({ ...base, sales, stock: {} }).ingredients[0].contributions[0];
    expect(c.trend).toBe(1.1);
    expect(c.ma14).toBe(15);
  });

  test("weekday pattern shifts the daily split but not a flat week's total", () => {
    // Sundays sell 24, other days 10 → index for Sunday > 1.
    const sales = flatSales(10).map((s) => (new Date(`${s.date}T00:00:00Z`).getUTCDay() === 0 ? { ...s, units: 24 } : s));
    const b = computeForecast({ ...base, sales, stock: {} }).ingredients[0];
    const sunday = b.daily.find((d) => new Date(`${d.date}T00:00:00Z`).getUTCDay() === 0)!;
    const monday = b.daily.find((d) => new Date(`${d.date}T00:00:00Z`).getUTCDay() === 1)!;
    expect(sunday.quantity).toBeGreaterThan(monday.quantity * 2);
  });

  test("no sales history → zero forecast", () => {
    const b = computeForecast({ ...base, sales: [], stock: {} }).ingredients[0];
    expect(b.forecast).toBe(0);
    expect(b.suggested).toBe(0);
  });

  test("helpers", () => {
    expect(ceilTo(9.79, 0.5)).toBe(10);
    expect(ceilTo(10, 0.5)).toBe(10);
    expect(supplyPosition({ forecast: 10, buffer: 1, stock: 2 }, 6)).toBe(-3);
  });
});
