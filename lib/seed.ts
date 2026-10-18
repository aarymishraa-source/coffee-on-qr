// All demo data lives here — see CLAUDE.md §7.
import type { TempReading } from "./thermal";
import { registerIngredientNames } from "./match";

export function demoDate(h: number, m: number): Date {
  return new Date(2026, 9, 17, h, m, 0, 0);
}

export const DEMO_START = demoDate(18, 10);

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export type Diet = "veg" | "non-veg";

export interface Ingredient {
  id: string;
  name: string;
  diet: Diet;
  notes: string[];
  allergens: string[];
  cafeCount: number;
}

export const INGREDIENTS: Ingredient[] = [
  { id: "basil-pesto", name: "Basil pesto", diet: "veg", notes: ["Herby", "Nutty", "Garlicky"], allergens: ["nuts"], cafeCount: 3 },
  { id: "paneer", name: "Paneer", diet: "veg", notes: ["Creamy", "Mild"], allergens: ["dairy"], cafeCount: 3 },
  { id: "roasted-peppers", name: "Roasted peppers", diet: "veg", notes: ["Smoky", "Sweet"], allergens: [], cafeCount: 3 },
  { id: "chilli", name: "Chilli", diet: "veg", notes: ["Hot", "Bright"], allergens: [], cafeCount: 2 },
  { id: "mushroom", name: "Mushroom", diet: "veg", notes: ["Earthy", "Umami"], allergens: [], cafeCount: 2 },
  { id: "spinach", name: "Spinach", diet: "veg", notes: ["Fresh", "Green"], allergens: [], cafeCount: 2 },
  { id: "sourdough", name: "Sourdough", diet: "veg", notes: ["Tangy", "Chewy"], allergens: ["gluten"], cafeCount: 2 },
  { id: "rocket", name: "Rocket", diet: "veg", notes: ["Peppery"], allergens: [], cafeCount: 1 },
  { id: "chicken", name: "Chicken", diet: "non-veg", notes: ["Savoury", "Lean"], allergens: [], cafeCount: 1 },
  { id: "cold-brew", name: "Cold brew", diet: "veg", notes: ["Bold", "Smooth"], allergens: [], cafeCount: 1 },
  { id: "blueberry", name: "Blueberry", diet: "veg", notes: ["Sweet", "Tart"], allergens: [], cafeCount: 1 },
  { id: "noodles", name: "Noodles", diet: "veg", notes: ["Soft", "Comforting"], allergens: ["gluten"], cafeCount: 1 },
  // Not swipeable — a realistic base ingredient for Iced Latte that keeps its
  // match score from saturating to a perfect 100% on a single liked ingredient.
  { id: "milk", name: "Milk", diet: "veg", notes: ["Creamy"], allergens: ["dairy"], cafeCount: 3 },
];

export const INGREDIENT_BY_ID: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i])
);

/** The 12 swipeable ingredient cards shown in Taste Match (excludes base ingredients like milk). */
export const SWIPEABLE_INGREDIENT_IDS = INGREDIENTS.filter((i) => i.id !== "milk").map((i) => i.id);

// ---------------------------------------------------------------------------
// Cafés
// ---------------------------------------------------------------------------

export interface Cafe {
  id: string;
  name: string;
  distanceKm: number;
  open: boolean;
}

export const CAFES: Cafe[] = [
  { id: "brew-room", name: "The Brew Room Café", distanceKm: 0.6, open: true },
  { id: "urban-bean", name: "Urban Bean Café", distanceKm: 1.1, open: true },
  { id: "cafe-47", name: "Café 47", distanceKm: 1.4, open: true },
];

export const CAFE_BY_ID: Record<string, Cafe> = Object.fromEntries(CAFES.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Dishes
// ---------------------------------------------------------------------------

export type Spice = "mild" | "medium" | "spicy";

export interface Dish {
  id: string;
  name: string;
  price: number;
  cafeId: string;
  cafeName: string;
  ingredientIds: string[];
  allergens: string[];
  diet: Diet;
  spice: Spice;
  stock: number | "available"; // seed/base stock; live stock lives in the store
  batchId?: string;
  whyOverride?: string;
  allergenWarning?: string;
}

export const DISHES: Dish[] = [
  {
    id: "pesto-paneer-sandwich",
    name: "Pesto Paneer Sandwich",
    price: 220,
    cafeId: "brew-room",
    cafeName: "The Brew Room Café",
    ingredientIds: ["basil-pesto", "paneer", "sourdough", "roasted-peppers", "rocket"],
    allergens: ["nuts", "dairy", "gluten"],
    diet: "veg",
    spice: "mild",
    stock: 4,
  },
  {
    id: "veg-sandwich",
    name: "Veg Sandwich",
    price: 220,
    cafeId: "brew-room",
    cafeName: "The Brew Room Café",
    ingredientIds: ["paneer", "roasted-peppers", "sourdough", "spinach"],
    allergens: ["dairy", "gluten"],
    diet: "veg",
    spice: "mild",
    stock: 6,
    batchId: "S118",
  },
  {
    id: "iced-latte",
    name: "Iced Latte",
    price: 190,
    cafeId: "urban-bean",
    cafeName: "Urban Bean Café",
    ingredientIds: ["cold-brew", "milk"],
    allergens: ["dairy"],
    diet: "veg",
    spice: "mild",
    stock: "available",
    whyOverride: "Matches your 'less sweet, strong' coffee picks",
  },
  {
    id: "blueberry-muffin",
    name: "Blueberry Muffin",
    price: 150,
    cafeId: "cafe-47",
    cafeName: "Café 47",
    ingredientIds: ["blueberry"],
    allergens: ["gluten", "dairy"],
    diet: "veg",
    spice: "mild",
    stock: 6,
    whyOverride: "Fits your under-₹250 budget",
  },
  {
    id: "paneer-tikka-bowl",
    name: "Paneer Tikka Bowl",
    price: 220,
    cafeId: "brew-room",
    cafeName: "The Brew Room Café",
    ingredientIds: ["paneer", "chilli", "roasted-peppers"],
    allergens: ["dairy"],
    diet: "veg",
    spice: "spicy",
    stock: 5,
  },
  {
    id: "creamy-mushroom-pasta",
    name: "Creamy Mushroom Pasta",
    price: 240,
    cafeId: "cafe-47",
    cafeName: "Café 47",
    ingredientIds: ["mushroom", "spinach"],
    allergens: ["peanuts", "dairy", "gluten"],
    diet: "veg",
    spice: "mild",
    stock: 4,
    allergenWarning: "Ask staff to confirm a suitable alternative",
  },
  {
    id: "grilled-chicken-bowl",
    name: "Grilled Chicken Bowl",
    price: 260,
    cafeId: "urban-bean",
    cafeName: "Urban Bean Café",
    ingredientIds: ["chicken", "spinach"],
    allergens: [],
    diet: "non-veg",
    spice: "medium",
    stock: 5,
  },
  {
    id: "chilli-garlic-noodles",
    name: "Chilli Garlic Noodles",
    price: 200,
    cafeId: "urban-bean",
    cafeName: "Urban Bean Café",
    ingredientIds: ["noodles", "chilli", "mushroom"],
    allergens: ["gluten"],
    diet: "veg",
    spice: "spicy",
    stock: 6,
  },
];

export const DISH_BY_ID: Record<string, Dish> = Object.fromEntries(DISHES.map((d) => [d.id, d]));

// ---------------------------------------------------------------------------
// Batches · Thermal Debt
// ---------------------------------------------------------------------------

export interface BatchSeed {
  id: string;
  name: string;
  prepLabel: string; // "10:00"
  prepAt: Date;
  saleWindowEnd: Date;
  readings: TempReading[];
  /** true once this probe has gone offline — no further readings arrive */
  offlineSince?: Date;
}

function r(h: number, m: number, temp: number): TempReading {
  return { at: demoDate(h, m), temp };
}

export const BATCHES: BatchSeed[] = [
  {
    // Within limits · ~3h 00m · debt ≈ 25% of budget
    id: "P023",
    name: "Paneer filling",
    prepLabel: "10:00",
    prepAt: demoDate(10, 0),
    saleWindowEnd: demoDate(21, 10),
    readings: [
      r(10, 0, 3.8), r(10, 30, 3.9), r(11, 0, 4.0), r(11, 30, 4.0),
      r(12, 0, 4.1), r(12, 30, 4.3), r(13, 0, 6.0), r(13, 30, 4.4),
      r(14, 0, 4.0), r(14, 30, 4.0), r(15, 0, 4.0), r(15, 30, 4.1),
      r(16, 0, 4.0), r(16, 30, 4.1), r(17, 0, 4.0), r(17, 30, 4.1),
      r(18, 0, 4.1), r(18, 10, 4.2),
    ],
  },
  {
    // Within limits · ~1h 50m · debt ≈ 58% of budget — the dish the whole
    // Second Serve demo flow revolves around. Has a visible 2 PM bump.
    id: "S118",
    name: "Veg Sandwich",
    prepLabel: "11:00",
    prepAt: demoDate(11, 0),
    saleWindowEnd: demoDate(20, 0),
    readings: [
      r(11, 0, 4.0), r(11, 30, 4.1), r(12, 0, 4.3), r(12, 30, 4.6),
      r(13, 0, 5.0), r(13, 30, 6.4), r(14, 0, 5.9), r(14, 30, 4.8),
      r(15, 0, 4.5), r(15, 30, 4.3), r(16, 0, 4.2), r(16, 30, 4.3),
      r(17, 0, 4.4), r(17, 30, 4.6), r(18, 0, 4.9), r(18, 10, 5.1),
    ],
  },
  {
    // Warning · staff review · debt ≈ 84% of budget — fine most of the day,
    // then a recent rise staff need to catch before it tips into Blocked.
    id: "R041",
    name: "Cooked rice tray",
    prepLabel: "12:30",
    prepAt: demoDate(12, 30),
    saleWindowEnd: demoDate(21, 0),
    readings: [
      r(12, 30, 4.6), r(13, 0, 4.7), r(13, 30, 4.7), r(14, 0, 4.8),
      r(14, 30, 4.8), r(15, 0, 4.9), r(15, 30, 4.9), r(16, 0, 5.0),
      r(16, 30, 5.0), r(17, 0, 5.0), r(17, 30, 5.0), r(17, 40, 5.0),
      r(17, 50, 6.5), r(18, 0, 8.0), r(18, 10, 9.8),
    ],
  },
  {
    // Blocked · sale window ended — left out of temperature control for most
    // of the day, comfortably over budget.
    id: "C044",
    name: "Chicken tikka filling",
    prepLabel: "09:15",
    prepAt: demoDate(9, 15),
    saleWindowEnd: demoDate(19, 30),
    readings: [
      r(9, 15, 8.0), r(9, 45, 9.0), r(10, 15, 9.5), r(10, 45, 10.0),
      r(11, 15, 10.2), r(11, 45, 10.4), r(12, 15, 10.6), r(12, 45, 10.8),
      r(13, 15, 11.0), r(13, 45, 11.0), r(14, 15, 11.1), r(14, 45, 11.1),
      r(15, 15, 11.2), r(15, 45, 11.2), r(16, 15, 11.3), r(16, 45, 11.3),
      r(17, 15, 11.3), r(17, 45, 11.4), r(18, 10, 11.4),
    ],
  },
  {
    // Unknown · no data — probe went offline at 4:40 PM, matching the
    // console KPI "1 probe offline since 4:40 PM".
    id: "B207",
    name: "Cold brew concentrate",
    prepLabel: "08:00",
    prepAt: demoDate(8, 0),
    saleWindowEnd: demoDate(22, 0),
    offlineSince: demoDate(16, 40),
    readings: [
      r(8, 0, 3.0), r(9, 0, 3.2), r(10, 0, 3.3), r(11, 0, 3.4),
      r(12, 0, 3.5), r(13, 0, 3.6), r(14, 0, 3.7), r(15, 0, 3.8),
      r(16, 0, 3.9), r(16, 40, 4.0),
    ],
  },
];

export const BATCH_BY_ID: Record<string, BatchSeed> = Object.fromEntries(
  BATCHES.map((b) => [b.id, b])
);

// ---------------------------------------------------------------------------
// Customer profile — seeded so Picked for you is already ranked before any
// swipes happen.
// ---------------------------------------------------------------------------

export const RIYA_PROFILE = {
  name: "Riya",
  diet: "veg" as Diet,
  budget: 250,
  likedIngredientIds: ["basil-pesto", "paneer", "roasted-peppers", "cold-brew"],
  dislikedIngredientIds: [] as string[],
  avoidAllergens: [] as string[],
  whatsappOptIn: true,
  brewPoints: 340,
};

/**
 * Before any taste swipes, "Picked for you" leads with these three dishes
 * at these percentages — matching the design mockup exactly. See
 * rankDishesForDisplay() in lib/match.ts for how/when this applies.
 */
export const FEATURED_PICKS_DEFAULT = [
  { dishId: "pesto-paneer-sandwich", display: 96 },
  { dishId: "iced-latte", display: 91 },
  { dishId: "blueberry-muffin", display: 84 },
];

// ---------------------------------------------------------------------------
// Console KPI baselines — "today so far" before the demo's live actions.
// ---------------------------------------------------------------------------

export const KPI_SEED = {
  recoveredRevenueBase: 1848, // 12 × ₹154
  secondServeOrdersBase: 12,
  secondServePrice: 154, // round(220 × 0.7)
  predictedSurplusUnits: 9,
  predictedSurplusBatches: 3,
  batchesMonitored: 12,
  sensorUptimePct: 99.2,
  probeOfflineSince: "4:40 PM",
};

// ---------------------------------------------------------------------------
// This week · forecast vs actual unsold (Mon–Sun)
// ---------------------------------------------------------------------------

export const FORECAST_VS_ACTUAL = {
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  forecast: [8, 5, 9, 6, 11, 8, 7],
  actual: [7, 6, 8, 4, 10, 3, null] as Array<number | null>,
};

export const LOOP_STEPS = [
  { id: "sensor", label: "Sensor history" },
  { id: "gate", label: "Safety gate" },
  { id: "forecast", label: "Demand forecast" },
  { id: "approval", label: "Manager approval" },
  { id: "offer", label: "Matched offer" },
  { id: "learn", label: "Learn & improve" },
] as const;

registerIngredientNames(
  Object.fromEntries(INGREDIENTS.map((i) => [i.id, i.name]))
);
