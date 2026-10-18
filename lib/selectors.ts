// Derived read-only views over the store — kept out of components so the
// same math is used by /console, /app and /demo.
import { DISH_BY_ID, KPI_SEED } from "./seed";
import { computeThermal, isOfferable, type ThermalResult, type ThermalStatus, type TempReading } from "./thermal";
import type { BatchState, Offer, Reservation } from "./store";

// Deliberately not importing from ./store here (beyond types) — that module
// creates the Zustand/localStorage-backed store at module scope, which only
// exists in the browser. Keeping this file to type-only store imports lets
// it run anywhere, including the Node-based self-check script.
function batchReadings(batch: BatchState): TempReading[] {
  return batch.readings.map((reading) => ({ at: new Date(reading.atMs), temp: reading.temp }));
}

export function getBatchThermal(batch: BatchState, now: Date): ThermalResult {
  const readings = batchReadings(batch);
  const result = computeThermal(readings, new Date(batch.saleWindowEndMs), now);
  // A manually-flagged offline probe is always Unknown, regardless of how
  // recently it last reported — that's the whole point of the toggle.
  if (batch.probeOffline) {
    return { ...result, status: "unknown", windowLeftMinutes: null };
  }
  return result;
}

/** Blocked/Unknown batches can never carry an offer — see CLAUDE.md §9 rule 2. */
export function isOfferWithdrawn(status: ThermalStatus): boolean {
  return status === "blocked" || status === "unknown";
}

/** Warning batches need staff review and are never auto-offered either, even though they're not "withdrawn". */
export function canApproveOffer(status: ThermalStatus): boolean {
  return isOfferable(status);
}

export function offerPrice(offer: Offer): number {
  const dish = DISH_BY_ID[offer.dishId];
  return Math.round(dish.price * (1 - offer.discountPct / 100));
}

export interface ConsoleKpis {
  recoveredRevenue: number;
  secondServeOrders: number;
  predictedSurplusUnits: number;
  predictedSurplusBatches: number;
  batchesMonitored: number;
  warningCount: number;
  blockedCount: number;
  sensorUptimePct: number;
  offlineCount: number;
  offlineSinceLabel: string;
}

export function getConsoleKpis(
  batches: Record<string, BatchState>,
  reservations: Reservation[],
  now: Date
): ConsoleKpis {
  const results = Object.values(batches).map((b) => getBatchThermal(b, now));
  const warningCount = results.filter((r) => r.status === "warning").length;
  const blockedCount = results.filter((r) => r.status === "blocked").length;
  const offlineCount = Object.values(batches).filter((b) => b.probeOffline).length;

  const secondServeReservations = reservations.filter((r) => r.secondServe);
  const recoveredRevenue =
    KPI_SEED.recoveredRevenueBase + secondServeReservations.reduce((sum, r) => sum + r.priceAtReservation, 0);
  const secondServeOrders = KPI_SEED.secondServeOrdersBase + secondServeReservations.length;

  return {
    recoveredRevenue,
    secondServeOrders,
    predictedSurplusUnits: KPI_SEED.predictedSurplusUnits,
    predictedSurplusBatches: KPI_SEED.predictedSurplusBatches,
    batchesMonitored: KPI_SEED.batchesMonitored,
    warningCount,
    blockedCount,
    sensorUptimePct: KPI_SEED.sensorUptimePct,
    offlineCount,
    offlineSinceLabel: KPI_SEED.probeOfflineSince,
  };
}

export function pendingOffersNeedingAttention(offers: Offer[], batches: Record<string, BatchState>, now: Date): number {
  return offers.filter((o) => {
    if (o.status !== "pending") return false;
    const batch = batches[o.batchId];
    if (!batch) return false;
    return !isOfferWithdrawn(getBatchThermal(batch, now).status);
  }).length;
}
