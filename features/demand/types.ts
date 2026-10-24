// Client-side shapes of the supply API (mirrors server/services/demand.service.ts).
export type SupplyStatus = "covered" | "supplier" | "not_offered" | "offered" | "partial" | "committed" | "fulfilled";

export interface DishContribution {
  menuItemId: string;
  name: string;
  cafeName: string;
  ma14: number;
  ma7: number;
  trend: number;
  forecastUnits: number;
  perServing: number;
  quantity: number;
}

export interface SupplyRow {
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
  farmSourced: boolean;
  pricePerKg: number;
  adjusted: number | null;
  target: number;
  committed: number;
  open: number;
  position: number;
  status: SupplyStatus;
  offer: {
    id: string;
    status: string;
    quantity: number;
    pricePerKg: number;
    sentAt: string | null;
    commitments: { farmerId: string; farmerName: string; village: string; quantity: number; status: string; at: string }[];
  } | null;
  adjustments: { from: number; to: number; reason: string; at: string; by: string }[];
}

export interface SupplyOverview {
  forecast: { method: string; startDate: string; endDate: string; historyStart: string; historyEnd: string };
  rows: SupplyRow[];
  trend: { date: string; orders: number; revenue: number }[];
}

export const STATUS_LABEL: Record<SupplyStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  covered: { label: "Covered by stock", tone: "success" },
  supplier: { label: "Regular supplier", tone: "neutral" },
  not_offered: { label: "Not offered yet", tone: "warning" },
  offered: { label: "Waiting for farmers", tone: "warning" },
  partial: { label: "Partly committed", tone: "warning" },
  committed: { label: "Fully committed", tone: "success" },
  fulfilled: { label: "Delivered", tone: "success" },
};
