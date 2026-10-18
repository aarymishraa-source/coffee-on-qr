// Single shared Zustand store — both /app and /console (and /demo, which
// renders them side by side) read and write this same state. See CLAUDE.md
// §2 and §8.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BATCHES,
  DEMO_START,
  DISHES,
  DISH_BY_ID,
  KPI_SEED,
  RIYA_PROFILE,
  type Diet,
} from "./seed";
import type { TempReading } from "./thermal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadingPoint {
  atMs: number;
  temp: number;
}

export interface BatchState {
  id: string;
  name: string;
  prepLabel: string;
  prepAtMs: number;
  saleWindowEndMs: number;
  readings: ReadingPoint[];
  probeOffline: boolean;
  /** staged temperature the sensor simulator will write next */
  pendingSimTemp: number;
}

export interface Reservation {
  id: string;
  dishId: string;
  pickupCode: string;
  slotLabel: string;
  createdAtMs: number;
  brewPointsEarned: number;
  priceAtReservation: number;
  secondServe: boolean;
}

export type OfferStatus = "pending" | "approved" | "withdrawn" | "skipped";

export interface Offer {
  id: string;
  dishId: string;
  batchId: string;
  discountPct: number;
  status: OfferStatus;
  likelyUnsold: number;
  matchedOptedIn: number;
  eligibleUntilMs: number;
  sentCount: number;
  reservedCount: number;
  createdAtMs: number;
}

export interface AuditEntry {
  id: string;
  atMs: number;
  message: string;
}

export interface CustomerProfileState {
  diet: Diet;
  budget: number;
  likedIngredientIds: string[];
  dislikedIngredientIds: string[];
  swipedIngredientIds: string[];
  avoidAllergens: string[];
  whatsappOptIn: boolean;
  brewPoints: number;
}

export type SwipeDirection = "like" | "skip" | "unsure";

export interface StoreState {
  // demo clock — see now()/nowMs() below for how this is read
  realAnchorMs: number;
  demoAnchorMs: number;
  fastForwardMs: number;

  batches: Record<string, BatchState>;
  dishStock: Record<string, number | "available">;
  profile: CustomerProfileState;
  reservations: Reservation[];
  offers: Offer[];
  auditLog: AuditEntry[];

  now: () => Date;
  nowMs: () => number;

  fastForward30: () => void;
  toggleProbeOffline: (batchId: string) => void;
  setSimTemp: (batchId: string, temp: number) => void;

  swipeIngredient: (ingredientId: string, direction: SwipeDirection) => void;

  reserveDish: (
    dishId: string,
    slotLabel: string,
    opts?: { secondServe?: boolean; priceOverride?: number; offerId?: string }
  ) => string;

  approveOffer: (offerId: string) => void;
  editOfferDiscount: (offerId: string, pct: number) => void;
  skipOffer: (offerId: string) => void;

  addAuditEntry: (message: string) => void;

  resetDemo: () => void;
}

// ---------------------------------------------------------------------------
// Seed → initial state
// ---------------------------------------------------------------------------

function buildInitialBatches(): Record<string, BatchState> {
  const out: Record<string, BatchState> = {};
  for (const b of BATCHES) {
    const lastTemp = b.readings.length > 0 ? b.readings[b.readings.length - 1].temp : 5;
    out[b.id] = {
      id: b.id,
      name: b.name,
      prepLabel: b.prepLabel,
      prepAtMs: b.prepAt.getTime(),
      saleWindowEndMs: b.saleWindowEnd.getTime(),
      readings: b.readings.map((reading) => ({ atMs: reading.at.getTime(), temp: reading.temp })),
      probeOffline: Boolean(b.offlineSince),
      pendingSimTemp: lastTemp,
    };
  }
  return out;
}

function buildInitialDishStock(): Record<string, number | "available"> {
  return Object.fromEntries(DISHES.map((d) => [d.id, d.stock]));
}

function buildInitialProfile(): CustomerProfileState {
  return {
    diet: RIYA_PROFILE.diet,
    budget: RIYA_PROFILE.budget,
    likedIngredientIds: [...RIYA_PROFILE.likedIngredientIds],
    dislikedIngredientIds: [...RIYA_PROFILE.dislikedIngredientIds],
    swipedIngredientIds: [],
    avoidAllergens: [...RIYA_PROFILE.avoidAllergens],
    whatsappOptIn: RIYA_PROFILE.whatsappOptIn,
    brewPoints: RIYA_PROFILE.brewPoints,
  };
}

function buildInitialOffers(): Offer[] {
  const s118 = BATCHES.find((b) => b.id === "S118")!;
  return [
    {
      id: "offer-s118",
      dishId: "veg-sandwich",
      batchId: "S118",
      discountPct: 30,
      status: "pending",
      likelyUnsold: 6,
      matchedOptedIn: 42,
      eligibleUntilMs: s118.saleWindowEnd.getTime(),
      sentCount: 0,
      reservedCount: 0,
      createdAtMs: DEMO_START.getTime(),
    },
  ];
}

function randomCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `BR-${n}`;
}

let auditCounter = 0;
function nextAuditId(): string {
  auditCounter += 1;
  return `audit-${auditCounter}`;
}

let reservationCounter = 0;
function nextReservationId(): string {
  reservationCounter += 1;
  return `reservation-${reservationCounter}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const KPI_BASE = KPI_SEED;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      realAnchorMs: Date.now(),
      demoAnchorMs: DEMO_START.getTime(),
      fastForwardMs: 0,

      batches: buildInitialBatches(),
      dishStock: buildInitialDishStock(),
      profile: buildInitialProfile(),
      reservations: [],
      offers: buildInitialOffers(),
      auditLog: [],

      now: () => new Date(get().nowMs()),
      nowMs: () => {
        const { realAnchorMs, demoAnchorMs, fastForwardMs } = get();
        return demoAnchorMs + (Date.now() - realAnchorMs) + fastForwardMs;
      },

      fastForward30: () => {
        const nowMs = get().nowMs();
        const newFastForwardMs = get().fastForwardMs + 30 * 60_000;
        set((state) => {
          const batches: Record<string, BatchState> = {};
          for (const [id, batch] of Object.entries(state.batches)) {
            if (batch.probeOffline) {
              batches[id] = batch;
              continue;
            }
            const readings = [
              ...batch.readings,
              { atMs: nowMs + 30 * 60_000, temp: batch.pendingSimTemp },
            ];
            batches[id] = { ...batch, readings };
          }
          return { fastForwardMs: newFastForwardMs, batches };
        });
        get().addAuditEntry("Fast-forwarded the demo clock 30 minutes");
      },

      toggleProbeOffline: (batchId) => {
        set((state) => {
          const batch = state.batches[batchId];
          if (!batch) return state;
          const probeOffline = !batch.probeOffline;
          const readings = probeOffline
            ? batch.readings
            : [...batch.readings, { atMs: get().nowMs(), temp: batch.pendingSimTemp }];
          return {
            batches: {
              ...state.batches,
              [batchId]: { ...batch, probeOffline, readings },
            },
          };
        });
        const batch = get().batches[batchId];
        get().addAuditEntry(
          `${batch.name} probe ${batch.probeOffline ? "went offline" : "came back online"}`
        );
      },

      setSimTemp: (batchId, temp) => {
        set((state) => {
          const batch = state.batches[batchId];
          if (!batch) return state;
          const readings = batch.probeOffline
            ? batch.readings
            : [...batch.readings, { atMs: get().nowMs(), temp }];
          return {
            batches: {
              ...state.batches,
              [batchId]: { ...batch, pendingSimTemp: temp, readings },
            },
          };
        });
      },

      swipeIngredient: (ingredientId, direction) => {
        set((state) => {
          const swipedIngredientIds = state.profile.swipedIngredientIds.includes(ingredientId)
            ? state.profile.swipedIngredientIds
            : [...state.profile.swipedIngredientIds, ingredientId];

          let likedIngredientIds = state.profile.likedIngredientIds;
          let dislikedIngredientIds = state.profile.dislikedIngredientIds;

          if (direction === "like" && !likedIngredientIds.includes(ingredientId)) {
            likedIngredientIds = [...likedIngredientIds, ingredientId];
            dislikedIngredientIds = dislikedIngredientIds.filter((id) => id !== ingredientId);
          } else if (direction === "skip" && !dislikedIngredientIds.includes(ingredientId)) {
            dislikedIngredientIds = [...dislikedIngredientIds, ingredientId];
            likedIngredientIds = likedIngredientIds.filter((id) => id !== ingredientId);
          }

          return {
            profile: {
              ...state.profile,
              swipedIngredientIds,
              likedIngredientIds,
              dislikedIngredientIds,
            },
          };
        });
      },

      reserveDish: (dishId, slotLabel, opts) => {
        const dish = DISH_BY_ID[dishId];
        const price = opts?.priceOverride ?? dish.price;
        const pickupCode = randomCode();
        const brewPointsEarned = Math.round(price * 0.1);

        set((state) => {
          const currentStock = state.dishStock[dishId];
          const dishStock =
            typeof currentStock === "number"
              ? { ...state.dishStock, [dishId]: Math.max(0, currentStock - 1) }
              : state.dishStock;

          const reservation: Reservation = {
            id: nextReservationId(),
            dishId,
            pickupCode,
            slotLabel,
            createdAtMs: get().nowMs(),
            brewPointsEarned,
            priceAtReservation: price,
            secondServe: Boolean(opts?.secondServe),
          };

          const offers = opts?.offerId
            ? state.offers.map((o) =>
                o.id === opts.offerId ? { ...o, reservedCount: o.reservedCount + 1 } : o
              )
            : state.offers;

          return {
            dishStock,
            reservations: [...state.reservations, reservation],
            offers,
            profile: { ...state.profile, brewPoints: state.profile.brewPoints + brewPointsEarned },
          };
        });

        get().addAuditEntry(`Reserved ${dish.name} · pickup ${pickupCode}`);
        return pickupCode;
      },

      approveOffer: (offerId) => {
        set((state) => ({
          offers: state.offers.map((o) =>
            o.id === offerId ? { ...o, status: "approved", sentCount: o.matchedOptedIn } : o
          ),
        }));
        const offer = get().offers.find((o) => o.id === offerId);
        if (offer) {
          const dish = DISH_BY_ID[offer.dishId];
          get().addAuditEntry(`Approved ${dish.name} offer · sent to ${offer.matchedOptedIn} customers`);
        }
      },

      editOfferDiscount: (offerId, pct) => {
        set((state) => ({
          offers: state.offers.map((o) => (o.id === offerId ? { ...o, discountPct: pct } : o)),
        }));
        const offer = get().offers.find((o) => o.id === offerId);
        if (offer) {
          const dish = DISH_BY_ID[offer.dishId];
          get().addAuditEntry(`Changed ${dish.name} offer discount to ${pct}%`);
        }
      },

      skipOffer: (offerId) => {
        set((state) => ({
          offers: state.offers.map((o) => (o.id === offerId ? { ...o, status: "skipped" } : o)),
        }));
        const offer = get().offers.find((o) => o.id === offerId);
        if (offer) {
          const dish = DISH_BY_ID[offer.dishId];
          get().addAuditEntry(`Skipped ${dish.name} offer`);
        }
      },

      addAuditEntry: (message) => {
        set((state) => ({
          auditLog: [
            { id: nextAuditId(), atMs: get().nowMs(), message },
            ...state.auditLog,
          ],
        }));
      },

      resetDemo: () => {
        set({
          realAnchorMs: Date.now(),
          demoAnchorMs: DEMO_START.getTime(),
          fastForwardMs: 0,
          batches: buildInitialBatches(),
          dishStock: buildInitialDishStock(),
          profile: buildInitialProfile(),
          reservations: [],
          offers: buildInitialOffers(),
          auditLog: [],
        });
      },
    }),
    {
      name: "coffee-on-qr-demo",
      version: 1,
    }
  )
);

export function readingsAsTempReadings(batch: BatchState): TempReading[] {
  return batch.readings.map((reading) => ({ at: new Date(reading.atMs), temp: reading.temp }));
}
