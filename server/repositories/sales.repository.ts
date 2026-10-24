import "server-only";
import type { Db } from "@/lib/db";
import type { DailySale } from "@/server/services/forecast.service";

// Sales adapter. The Coffee on QR customer app in this repo keeps live
// reservations in the browser; café order history lives in the SalesOrder
// table (one source of truth). To plug in the production Coffee on QR orders
// API, replace getDailySales with a call to it — the forecast only needs
// { menuItemId, date (IST), units }.

/** Daily units per menu item, grouped by IST calendar date, for dates in [from, to). */
export async function getDailySales(db: Db, from: string, to: string): Promise<DailySale[]> {
  const rows = await db.$queryRawUnsafe<{ menuItemId: string; date: string; units: number }[]>(
    `SELECT i."menuItemId" AS "menuItemId",
            to_char(o."placedAt" + interval '330 minutes', 'YYYY-MM-DD') AS "date",
            SUM(i."quantity")::int AS "units"
       FROM "SalesOrderItem" i
       JOIN "SalesOrder" o ON o."id" = i."orderId"
      WHERE o."placedAt" >= ($1::timestamp - interval '330 minutes')
        AND o."placedAt" <  ($2::timestamp - interval '330 minutes')
      GROUP BY 1, 2`,
    from,
    to
  );
  return rows.map((r) => ({ menuItemId: r.menuItemId, date: r.date, units: Number(r.units) }));
}

/** Latest IST date with any sales — forecasts start the day after. */
export async function getLastSalesDate(db: Db): Promise<string | null> {
  const rows = await db.$queryRawUnsafe<{ d: string | null }[]>(
    `SELECT to_char(MAX("placedAt") + interval '330 minutes', 'YYYY-MM-DD') AS d FROM "SalesOrder"`
  );
  return rows[0]?.d ?? null;
}

/** Orders and revenue per IST day for the trend chart. */
export async function getDailyOrderTotals(db: Db, from: string, to: string) {
  const rows = await db.$queryRawUnsafe<{ date: string; orders: number; revenue: number }[]>(
    `SELECT to_char(o."placedAt" + interval '330 minutes', 'YYYY-MM-DD') AS "date",
            COUNT(DISTINCT o."id")::int AS "orders",
            SUM(i."quantity" * i."unitPrice")::int AS "revenue"
       FROM "SalesOrder" o
       JOIN "SalesOrderItem" i ON i."orderId" = o."id"
      WHERE o."placedAt" >= ($1::timestamp - interval '330 minutes')
        AND o."placedAt" <  ($2::timestamp - interval '330 minutes')
      GROUP BY 1
      ORDER BY 1`,
    from,
    to
  );
  return rows.map((r) => ({ date: r.date, orders: Number(r.orders), revenue: Number(r.revenue) }));
}
