// Demo dataset for the Kisan Sahayak supply module. Everything here is
// clearly demo data (isDemo = true in the database) and is internally
// consistent: sales × recipes → forecast → offers → commitments → batches.
import { CAFES, DISHES } from "@/lib/seed";

/** Sales history runs SALES_START..SALES_END (inclusive); forecasts start the day after. */
export const SALES_START = "2026-09-20";
export const SALES_END = "2026-10-24";
export const FORECAST_START = "2026-10-25";
export const DEMO_PASSWORD = "demo1234";
export const DEMO_FPO_ID = "palghar-kisan-fpo";

export const CAFE_GEO: Record<string, { area: string; lat: number; lng: number }> = {
  "brew-room": { area: "Bandra West, Mumbai", lat: 19.0596, lng: 72.8295 },
  "urban-bean": { area: "Andheri East, Mumbai", lat: 19.1136, lng: 72.8697 },
  "cafe-47": { area: "Lower Parel, Mumbai", lat: 18.9986, lng: 72.8302 },
};

export const DEMO_CAFES = CAFES.map((c) => ({ id: c.id, name: c.name, ...CAFE_GEO[c.id] }));

export const DEMO_INGREDIENTS = [
  { id: "basil", name: "Basil", nameHi: "बेसिल", nameMr: "बेसिल", unit: "kg", perishable: true, pricePerKg: 180 },
  { id: "tomato", name: "Tomato", nameHi: "टमाटर", nameMr: "टोमॅटो", unit: "kg", perishable: true, pricePerKg: 32 },
  { id: "spinach", name: "Spinach", nameHi: "पालक", nameMr: "पालक", unit: "kg", perishable: true, pricePerKg: 40 },
  { id: "bell-pepper", name: "Bell pepper", nameHi: "शिमला मिर्च", nameMr: "ढोबळी मिरची", unit: "kg", perishable: true, pricePerKg: 85 },
  { id: "green-chilli", name: "Green chilli", nameHi: "हरी मिर्च", nameMr: "हिरवी मिरची", unit: "kg", perishable: true, pricePerKg: 60 },
  { id: "mushroom", name: "Mushroom", nameHi: "मशरूम", nameMr: "मशरूम", unit: "kg", perishable: true, pricePerKg: 210 },
  { id: "rocket", name: "Rocket leaves", nameHi: "रॉकेट पत्ता", nameMr: "रॉकेट पाने", unit: "kg", perishable: true, pricePerKg: 320 },
  { id: "paneer", name: "Paneer", nameHi: "पनीर", nameMr: "पनीर", unit: "kg", perishable: true, farmSourced: false, pricePerKg: 380 },
  { id: "milk", name: "Milk", nameHi: "दूध", nameMr: "दूध", unit: "l", perishable: true, farmSourced: false, pricePerKg: 62 },
];

/** Kitchen-only dishes that exist on café menus but not in the customer demo's taste deck. */
const EXTRA_MENU = [
  { id: "tomato-basil-soup", name: "Tomato Basil Soup", price: 180, cafeId: "brew-room" },
  { id: "margherita-toast", name: "Margherita Toast", price: 200, cafeId: "urban-bean" },
  { id: "pesto-pasta", name: "Basil Pesto Pasta", price: 260, cafeId: "cafe-47" },
];

export const DEMO_MENU = [
  ...DISHES.map((d) => ({ id: d.id, name: d.name, price: d.price, cafeId: d.cafeId })),
  ...EXTRA_MENU,
];

/** Grams (or ml) per serving. */
export const DEMO_RECIPES: Record<string, Record<string, number>> = {
  "pesto-paneer-sandwich": { basil: 25, paneer: 60, "bell-pepper": 30, rocket: 10 },
  "veg-sandwich": { paneer: 50, "bell-pepper": 30, spinach: 20, tomato: 30 },
  "paneer-tikka-bowl": { paneer: 90, "bell-pepper": 40, "green-chilli": 8, tomato: 40 },
  "tomato-basil-soup": { tomato: 220, basil: 8 },
  "iced-latte": { milk: 150 },
  "grilled-chicken-bowl": { spinach: 30, tomato: 30 },
  "chilli-garlic-noodles": { "green-chilli": 10, mushroom: 40, "bell-pepper": 20 },
  "margherita-toast": { tomato: 60, basil: 6 },
  "blueberry-muffin": { milk: 40 },
  "creamy-mushroom-pasta": { mushroom: 80, spinach: 25, basil: 5 },
  "pesto-pasta": { basil: 30, tomato: 40 },
};

/** Mean servings sold per day; weekday factors and a gentle trend are applied on top. */
export const DEMO_DAILY_MEAN: Record<string, number> = {
  "pesto-paneer-sandwich": 28,
  "veg-sandwich": 22,
  "paneer-tikka-bowl": 16,
  "tomato-basil-soup": 20,
  "iced-latte": 45,
  "grilled-chicken-bowl": 14,
  "chilli-garlic-noodles": 18,
  "margherita-toast": 25,
  "blueberry-muffin": 30,
  "creamy-mushroom-pasta": 18,
  "pesto-pasta": 14,
};

/** Sun..Sat */
export const WEEKDAY_FACTOR = [1.25, 0.85, 0.92, 0.95, 0.98, 1.1, 1.3];

/** On-hand stock per café, in kg / l. */
export const DEMO_STOCK: Record<string, Record<string, number>> = {
  "brew-room": { basil: 1.4, tomato: 6, spinach: 1.2, "bell-pepper": 2.5, "green-chilli": 0.4, paneer: 4, rocket: 0.3 },
  "urban-bean": { basil: 0.8, tomato: 3, spinach: 0.8, "bell-pepper": 1.2, "green-chilli": 0.6, mushroom: 5, milk: 12 },
  "cafe-47": { basil: 0.7, tomato: 2, spinach: 0.9, mushroom: 6, milk: 6 },
};

export const DEMO_FPO = { id: DEMO_FPO_ID, name: "Palghar Kisan FPO", district: "Palghar", state: "Maharashtra" };

export const DEMO_AGENTS = [
  { id: "agent-kavita", name: "Kavita More", phone: "919820000101" },
  { id: "agent-anil", name: "Anil Thakur", phone: "919820000102" },
];

export const DEMO_FARMERS = [
  {
    id: "farmer-ramesh", name: "Ramesh Patil", phone: "919800000001", language: "mr" as const,
    village: "Safale", district: "Palghar", fieldAgentId: "agent-kavita", areaAcres: 1.5, lat: 19.553, lng: 72.873,
    consentFarmStory: true,
    crops: [
      { crop: "basil", stage: "HARVEST_READY" as const, harvestInDays: 4, expectedQtyKg: 8 },
      { crop: "tomato", stage: "FLOWERING" as const, harvestInDays: 24, expectedQtyKg: 120 },
    ],
  },
  {
    id: "farmer-sunita", name: "Sunita Gawade", phone: "919800000002", language: "hi" as const,
    village: "Wada", district: "Palghar", fieldAgentId: "agent-anil", areaAcres: 1.2, lat: 19.652, lng: 73.137,
    consentFarmStory: true,
    crops: [
      { crop: "basil", stage: "HARVEST_READY" as const, harvestInDays: 5, expectedQtyKg: 5 },
      { crop: "spinach", stage: "VEGETATIVE" as const, harvestInDays: 12, expectedQtyKg: 40 },
    ],
  },
  {
    id: "farmer-ganesh", name: "Ganesh Valvi", phone: "919800000003", language: "mr" as const,
    village: "Jawhar", district: "Palghar", fieldAgentId: "agent-kavita", areaAcres: 3, lat: 19.912, lng: 73.231,
    consentFarmStory: true,
    crops: [
      { crop: "tomato", stage: "HARVEST_READY" as const, harvestInDays: 2, expectedQtyKg: 300 },
      { crop: "green-chilli", stage: "VEGETATIVE" as const, harvestInDays: 18, expectedQtyKg: 30 },
    ],
  },
  {
    id: "farmer-lakshmi", name: "Lakshmi Bhoir", phone: "919800000004", language: "mr" as const,
    village: "Vikramgad", district: "Palghar", fieldAgentId: "agent-anil", areaAcres: 0.8, lat: 19.81, lng: 73.09,
    consentFarmStory: false,
    crops: [
      { crop: "spinach", stage: "HARVEST_READY" as const, harvestInDays: 1, expectedQtyKg: 25 },
      { crop: "rocket", stage: "VEGETATIVE" as const, harvestInDays: 10, expectedQtyKg: 6 },
    ],
  },
  {
    id: "farmer-mohan", name: "Mohan Dhodi", phone: "919800000005", language: "hi" as const,
    village: "Talasari", district: "Palghar", fieldAgentId: "agent-kavita", areaAcres: 2, lat: 20.13, lng: 72.93,
    consentFarmStory: true,
    crops: [
      { crop: "bell-pepper", stage: "FLOWERING" as const, harvestInDays: 15, expectedQtyKg: 80 },
      { crop: "mushroom", stage: "HARVEST_READY" as const, harvestInDays: 3, expectedQtyKg: 20 },
    ],
  },
  {
    id: "farmer-asha", name: "Asha Jadhav", phone: "919800000006", language: "en" as const,
    village: "Dahanu", district: "Palghar", fieldAgentId: "agent-anil", areaAcres: 1, lat: 19.97, lng: 72.73,
    consentFarmStory: false,
    crops: [
      { crop: "tomato", stage: "VEGETATIVE" as const, harvestInDays: 30, expectedQtyKg: 90 },
      { crop: "basil", stage: "SOWING" as const, harvestInDays: 45, expectedQtyKg: 4 },
    ],
  },
];

export const DEMO_USERS = [
  { id: "user-admin", email: "admin@demo.coffeeonqr.in", name: "Aarav Shah", role: "ADMIN" as const },
  { id: "user-cafe", email: "cafe@demo.coffeeonqr.in", name: "Neha Kapoor", role: "CAFE_MANAGER" as const, cafeId: "brew-room" },
  { id: "user-fpo", email: "fpo@demo.coffeeonqr.in", name: "Meera Joshi", role: "FPO_MANAGER" as const, fpoId: DEMO_FPO_ID },
  { id: "user-kavita", email: "kavita@demo.coffeeonqr.in", name: "Kavita More", role: "FIELD_AGENT" as const, fpoId: DEMO_FPO_ID, fieldAgentId: "agent-kavita" },
  { id: "user-anil", email: "anil@demo.coffeeonqr.in", name: "Anil Thakur", role: "FIELD_AGENT" as const, fpoId: DEMO_FPO_ID, fieldAgentId: "agent-anil" },
  { id: "user-ramesh", email: "ramesh@demo.coffeeonqr.in", name: "Ramesh Patil", role: "FARMER" as const, fpoId: DEMO_FPO_ID, farmerId: "farmer-ramesh" },
  { id: "user-sunita", email: "sunita@demo.coffeeonqr.in", name: "Sunita Gawade", role: "FARMER" as const, fpoId: DEMO_FPO_ID, farmerId: "farmer-sunita" },
];
