export type Lang = "en" | "hi" | "mr";

export interface ConversationSummary {
  farmerId: string;
  name: string;
  village: string;
  language: Lang;
  lastMessage: { body: string; type: string; direction: "IN" | "OUT"; at: string; status: string } | null;
  lastAt: string;
  unread: number;
  tags: { order: boolean; cropHelp: boolean };
}

export interface ChatMessage {
  id: string;
  direction: "IN" | "OUT";
  author: "FARMER" | "ASSISTANT" | "STAFF" | "SYSTEM";
  type: "TEXT" | "IMAGE" | "AUDIO" | "OFFER" | "CROP_ANALYSIS" | "BATCH" | "PAYMENT";
  body: string;
  translation: string | null;
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  channel: "PORTAL" | "WHATSAPP";
  isDemoReply: boolean;
  agentAssisted: boolean;
  mediaUrl: string | null;
  payload: Record<string, unknown>;
  expertRequestedAt: string | null;
  createdAt: string;
}

export interface FarmerOffer {
  id: string;
  ingredientId: string;
  ingredient: string;
  quantity: number;
  pricePerKg: number;
  status: string;
  neededBy: string;
  open: number;
  mine: { quantity: number; status: string } | null;
}

export interface ConversationDetail {
  farmer: {
    id: string;
    name: string;
    phone: string;
    village: string;
    district: string;
    language: Lang;
    fpo: string | null;
    fieldAgent: string | null;
    areaAcres: number | null;
    lat: number | null;
    lng: number | null;
    contactPreference: string;
    crops: { crop: string; name: string; stage: string; expectedHarvestDate: string | null; expectedQtyKg: number | null }[];
  };
  offers: FarmerOffer[];
  messages: ChatMessage[];
}

export interface AssistantStatus {
  llm: string | null;
  speech: string | null;
  whatsapp: boolean;
}

export interface CropResult {
  image_usable: boolean;
  crop: string | null;
  symptoms_observed: string[];
  possible_causes: { name: string; confidence: "low" | "medium" | "high"; evidence: string }[];
  first_steps: string[];
  info_needed: string[];
  expert_review_recommended: boolean;
  limitations: string;
}

export const LANG_LABEL: Record<Lang, string> = { en: "English", hi: "हिंदी", mr: "मराठी" };
export const LANG_BCP47: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

export const STAGE_LABEL: Record<string, string> = {
  SOWING: "Sowing",
  VEGETATIVE: "Growing",
  FLOWERING: "Flowering",
  HARVEST_READY: "Ready to harvest",
  HARVESTED: "Harvested",
};

/** Farmer-language quick-reply texts posted into the chat with a structured answer. */
export const QUICK_REPLY: Record<Lang, { commit: (kg: string) => string; decline: string }> = {
  en: { commit: (kg) => `I can supply ${kg} kg`, decline: "I can't supply this time" },
  hi: { commit: (kg) => `मैं ${kg} किलो दे सकता/सकती हूँ`, decline: "इस बार नहीं दे पाऊँगा/पाऊँगी" },
  mr: { commit: (kg) => `मी ${kg} किलो देऊ शकतो/शकते`, decline: "या वेळी देऊ शकणार नाही" },
};
