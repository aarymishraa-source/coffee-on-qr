import { z } from "zod";

// Client-side shapes and form schema for farmer onboarding (server rules live in
// server/services/farmer.service.ts and are enforced again there).

export type Lang = "en" | "hi" | "mr";
export type Stage = "SOWING" | "VEGETATIVE" | "FLOWERING" | "HARVEST_READY" | "HARVESTED";

export const STAGES: { value: Stage; label: string }[] = [
  { value: "SOWING", label: "Sowing" },
  { value: "VEGETATIVE", label: "Growing" },
  { value: "FLOWERING", label: "Flowering" },
  { value: "HARVEST_READY", label: "Ready to harvest" },
  { value: "HARVESTED", label: "Harvested" },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label])) as Record<Stage, string>;

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "mr", label: "Marathi (मराठी)" },
  { value: "hi", label: "Hindi (हिंदी)" },
  { value: "en", label: "English" },
];
export const LANGUAGE_LABEL: Record<Lang, string> = { en: "English", hi: "Hindi", mr: "Marathi" };

export const CONTACT_LABEL = { WHATSAPP: "WhatsApp", CALL: "Phone call", SMS: "SMS" } as const;

export interface FarmerRow {
  id: string;
  name: string;
  phone: string;
  language: Lang;
  village: string;
  district: string;
  fpo: string | null;
  fieldAgent: string | null;
  crops: { crop: string; stage: Stage }[];
  consentFarmStory: boolean;
  isDemo: boolean;
}

export interface FarmerDetail {
  id: string;
  name: string;
  phone: string;
  language: Lang;
  village: string;
  district: string;
  fpoId: string | null;
  fpo: string | null;
  fieldAgentId: string | null;
  fieldAgent: string | null;
  areaAcres: number | null;
  lat: number | null;
  lng: number | null;
  contactPreference: keyof typeof CONTACT_LABEL;
  consentData: boolean;
  consentFarmStory: boolean;
  consentAt: string | null;
  isDemo: boolean;
  crops: { crop: string; stage: Stage; expectedHarvestDate: string | null; expectedQtyKg: number | null }[];
  commitments: {
    id: string;
    ingredient: string;
    unit: string;
    quantity: number;
    status: string;
    offerStatus: string;
    offerQuantity: number;
    neededBy: string;
  }[];
}

export interface IngredientOption {
  id: string;
  name: string;
  unit: string;
}

export function formatPhone(p: string) {
  const d = p.startsWith("91") && p.length === 12 ? p.slice(2) : p;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

const optionalNum = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), msg);

export const farmerFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the farmer's full name"),
  phone: z
    .string()
    .trim()
    .refine((v) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "")), "Enter a 10-digit Indian mobile number"),
  language: z.enum(["en", "hi", "mr"]),
  village: z.string().trim().min(2, "Enter the village"),
  district: z.string().trim().min(2, "Enter the district"),
  crops: z
    .array(z.object({ crop: z.string().min(1, "Pick a crop"), stage: z.enum(["SOWING", "VEGETATIVE", "FLOWERING", "HARVEST_READY", "HARVESTED"]) }))
    .min(1, "Add at least one crop"),
  fpoId: z.string(),
  fieldAgentId: z.string(),
  areaAcres: optionalNum(0, 1000, "Enter an area between 0 and 1000 acres"),
  lat: optionalNum(-90, 90, "Latitude must be between −90 and 90"),
  lng: optionalNum(-180, 180, "Longitude must be between −180 and 180"),
  contactPreference: z.enum(["WHATSAPP", "CALL", "SMS"]),
  consentData: z.boolean().refine((v) => v, "The farmer must agree before you can register them"),
  consentFarmStory: z.boolean(),
});
export type FarmerFormValues = z.infer<typeof farmerFormSchema>;

/** Form values → API payload (server re-validates). */
export function toPayload(v: FarmerFormValues) {
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  return {
    ...v,
    fpoId: v.fpoId || null,
    fieldAgentId: v.fieldAgentId || null,
    areaAcres: num(v.areaAcres),
    lat: num(v.lat),
    lng: num(v.lng),
  };
}
