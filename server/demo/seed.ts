import "server-only";
import bcrypt from "bcryptjs";
import type { Db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { addDays } from "@/server/services/forecast.service";
import { buildForecast } from "@/server/services/demand.service";
import {
  DEMO_AGENTS, DEMO_CAFES, DEMO_DAILY_MEAN, DEMO_FARMERS, DEMO_FPO, DEMO_FPO_ID, DEMO_INGREDIENTS,
  DEMO_MENU, DEMO_PASSWORD, DEMO_RECIPES, DEMO_STOCK, DEMO_USERS, FORECAST_START, SALES_END,
  SALES_START, WEEKDAY_FACTOR,
} from "./seed-data";

// Seeds (or re-seeds) the demo dataset. Reference data (cafés, ingredients,
// menu, recipes, FPO, agents) is upserted; transactional demo records are
// deleted and recreated. Records with isDemo = false are never touched.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A Date for an IST wall-clock time on a YYYY-MM-DD date. */
export function ist(date: string, h: number, m = 0): Date {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m) - 330 * 60_000);
}

export async function clearDemoData(db: Db) {
  await db.auditLog.deleteMany({ where: { isDemo: true } });
  await db.demandOffer.deleteMany({ where: { isDemo: true } });
  await db.demandForecast.deleteMany({ where: { offers: { none: {} } } });
  await db.farmer.deleteMany({ where: { isDemo: true } });
  await db.salesOrder.deleteMany({ where: { isDemo: true } });
  await db.media.deleteMany({ where: { isDemo: true } });
  await db.user.deleteMany({ where: { isDemo: true } });
  await db.webhookEvent.deleteMany({ where: { provider: "offer-response" } });
}

async function seedReference(db: Db) {
  for (const c of DEMO_CAFES) {
    await db.cafe.upsert({ where: { id: c.id }, update: { ...c, isDemo: true }, create: { ...c, isDemo: true } });
  }
  for (const i of DEMO_INGREDIENTS) {
    await db.ingredient.upsert({ where: { id: i.id }, update: i, create: i });
  }
  for (const m of DEMO_MENU) {
    await db.menuItem.upsert({ where: { id: m.id }, update: m, create: m });
  }
  await db.recipeIngredient.deleteMany({ where: { menuItemId: { in: DEMO_MENU.map((m) => m.id) } } });
  await db.recipeIngredient.createMany({
    data: Object.entries(DEMO_RECIPES).flatMap(([menuItemId, lines]) =>
      Object.entries(lines).map(([ingredientId, quantity]) => ({ menuItemId, ingredientId, quantity }))
    ),
  });
  for (const [cafeId, lines] of Object.entries(DEMO_STOCK)) {
    for (const [ingredientId, quantity] of Object.entries(lines)) {
      await db.stockLevel.upsert({
        where: { cafeId_ingredientId: { cafeId, ingredientId } },
        update: { quantity },
        create: { cafeId, ingredientId, quantity },
      });
    }
  }
  await db.fpo.upsert({ where: { id: DEMO_FPO.id }, update: { ...DEMO_FPO, isDemo: true }, create: { ...DEMO_FPO, isDemo: true } });
  for (const a of DEMO_AGENTS) {
    await db.fieldAgent.upsert({
      where: { id: a.id },
      update: { ...a, fpoId: DEMO_FPO_ID, isDemo: true },
      create: { ...a, fpoId: DEMO_FPO_ID, isDemo: true },
    });
  }
}

async function seedSales(db: Db) {
  const rand = mulberry32(20261024);
  const byCafe = new Map<string, typeof DEMO_MENU>();
  for (const m of DEMO_MENU) byCafe.set(m.cafeId, [...(byCafe.get(m.cafeId) ?? []), m]);

  const orders: Prisma.SalesOrderCreateManyInput[] = [];
  const items: Prisma.SalesOrderItemCreateManyInput[] = [];
  let dayIndex = 0;
  for (let date = SALES_START; date <= SALES_END; date = addDays(date, 1), dayIndex++) {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const trend = 1 + 0.004 * (dayIndex - 17);
    for (const [cafeId, menu] of byCafe) {
      const units: { id: string; price: number }[] = [];
      for (const m of menu) {
        const mean = DEMO_DAILY_MEAN[m.id] ?? 10;
        const n = Math.round(mean * WEEKDAY_FACTOR[dow] * trend * (0.88 + rand() * 0.24));
        for (let k = 0; k < n; k++) units.push({ id: m.id, price: m.price });
      }
      // Shuffle, then group into orders of 1–3 items placed 8 AM–10 PM IST.
      for (let k = units.length - 1; k > 0; k--) {
        const j = Math.floor(rand() * (k + 1));
        [units[k], units[j]] = [units[j], units[k]];
      }
      let n = 0;
      for (let k = 0; k < units.length; ) {
        const size = Math.min(units.length - k, 1 + Math.floor(rand() * 3));
        const id = `so-${cafeId}-${date}-${n++}`;
        const minute = 8 * 60 + Math.floor(rand() * 14 * 60);
        orders.push({ id, cafeId, placedAt: ist(date, Math.floor(minute / 60), minute % 60), isDemo: true });
        const counts = new Map<string, { quantity: number; price: number }>();
        for (const u of units.slice(k, k + size)) {
          const c = counts.get(u.id) ?? { quantity: 0, price: u.price };
          c.quantity++;
          counts.set(u.id, c);
        }
        for (const [menuItemId, c] of counts) items.push({ orderId: id, menuItemId, quantity: c.quantity, unitPrice: c.price });
        k += size;
      }
    }
  }
  for (let k = 0; k < orders.length; k += 2000) await db.salesOrder.createMany({ data: orders.slice(k, k + 2000) });
  for (let k = 0; k < items.length; k += 2000) await db.salesOrderItem.createMany({ data: items.slice(k, k + 2000) });
}

type SeedMessage = {
  daysAgo: number; h: number; m: number;
  dir: "IN" | "OUT"; author: "FARMER" | "ASSISTANT" | "SYSTEM";
  body: string; translation?: string; type?: "TEXT" | "OFFER"; payload?: Prisma.InputJsonValue;
  status?: "SENT" | "DELIVERED" | "READ";
};

const CONVERSATIONS: Record<string, SeedMessage[]> = {
  "farmer-ramesh": [
    { daysAgo: 2, h: 7, m: 42, dir: "IN", author: "FARMER", body: "नमस्कार, माझं बेसिल पुढच्या आठवड्यात काढणीला तयार होईल.", translation: "Hello, my basil will be ready to harvest next week." },
    { daysAgo: 2, h: 7, m: 43, dir: "OUT", author: "ASSISTANT", body: "छान! तुमच्या नोंदीनुसार साधारण ८ किलो बेसिल येईल. कॅफेकडून मागणी आली की मी लगेच कळवतो.", status: "READ" },
    { daysAgo: 1, h: 18, m: 5, dir: "IN", author: "FARMER", body: "काढणी सकाळी करावी की संध्याकाळी?", translation: "Should I harvest in the morning or the evening?" },
    { daysAgo: 1, h: 18, m: 6, dir: "OUT", author: "ASSISTANT", body: "सकाळी लवकर, दव सुकल्यावर काढणी करा. पाने थंड आणि ताजी राहतात. काढलेले बेसिल सावलीत ठेवा. (स्रोत: Kisan Sahayak पीक-काळजी मार्गदर्शिका)", status: "READ" },
  ],
  "farmer-sunita": [
    { daysAgo: 3, h: 9, m: 15, dir: "IN", author: "FARMER", body: "मेरी बेसिल में फूल आने लगे हैं, क्या करूँ?", translation: "My basil has started flowering, what should I do?" },
    { daysAgo: 3, h: 9, m: 16, dir: "OUT", author: "ASSISTANT", body: "फूल आने पर पत्तों का स्वाद कम हो सकता है। फूल वाली टहनियों को ऊपर से तोड़ दें ताकि पौधा नए पत्ते बनाता रहे। (स्रोत: Kisan Sahayak फसल-देखभाल गाइड)", status: "READ" },
    { daysAgo: 0, h: 8, m: 30, dir: "IN", author: "FARMER", body: "ठीक है, धन्यवाद। इस हफ्ते कोई ऑर्डर है?", translation: "Okay, thank you. Is there any order this week?" },
    { daysAgo: 0, h: 8, m: 31, dir: "OUT", author: "ASSISTANT", body: "अभी बेसिल का कोई खुला ऑर्डर नहीं है। कैफ़े से मांग आते ही मैं आपको बताऊँगा।", status: "DELIVERED" },
  ],
  "farmer-ganesh": [
    { daysAgo: 1, h: 10, m: 0, dir: "OUT", author: "SYSTEM", type: "OFFER", body: "नवीन मागणी: टोमॅटो", status: "READ" },
    { daysAgo: 1, h: 10, m: 12, dir: "IN", author: "FARMER", body: "मी २५ किलो देऊ शकतो.", translation: "I can supply 25 kg." },
    { daysAgo: 1, h: 10, m: 12, dir: "OUT", author: "ASSISTANT", body: "नोंद झाली: २५ किलो टोमॅटो. धन्यवाद, गणेशजी!", status: "READ" },
  ],
  "farmer-lakshmi": [
    { daysAgo: 1, h: 11, m: 20, dir: "OUT", author: "SYSTEM", type: "OFFER", body: "नवीन मागणी: पालक", status: "READ" },
    { daysAgo: 1, h: 11, m: 45, dir: "IN", author: "FARMER", body: "हो, सगळा पालक मी देते.", translation: "Yes, I'll supply all the spinach." },
    { daysAgo: 1, h: 11, m: 45, dir: "OUT", author: "ASSISTANT", body: "नोंद झाली. संपूर्ण मागणी तुम्ही पूर्ण केली — धन्यवाद, लक्ष्मीताई!", status: "READ" },
  ],
  "farmer-mohan": [
    { daysAgo: 4, h: 16, m: 10, dir: "IN", author: "FARMER", body: "शिमला मिर्च के पत्तों पर पीले धब्बे हैं।", translation: "There are yellow spots on the bell pepper leaves." },
    { daysAgo: 4, h: 16, m: 11, dir: "OUT", author: "ASSISTANT", body: "क्या आप पत्ते की साफ़ फ़ोटो भेज सकते हैं? दिन की रोशनी में, पत्ते के दोनों तरफ़ की फ़ोटो सबसे अच्छी रहेगी।", status: "READ" },
  ],
  "farmer-asha": [
    { daysAgo: 5, h: 12, m: 0, dir: "IN", author: "FARMER", body: "When should I transplant my basil seedlings?" },
    { daysAgo: 5, h: 12, m: 1, dir: "OUT", author: "ASSISTANT", body: "Transplant when seedlings have 2–3 pairs of true leaves, usually 4–6 weeks after sowing. Do it in the evening and water lightly. (Source: Kisan Sahayak crop-care guide)", status: "READ" },
  ],
};

export async function seedDemoData(db: Db) {
  await clearDemoData(db);
  await seedReference(db);

  // Farmers, crops, users.
  const today = SALES_END;
  for (const f of DEMO_FARMERS) {
    const { crops, consentFarmStory, ...rest } = f;
    await db.farmer.create({
      data: {
        ...rest,
        fpoId: DEMO_FPO_ID,
        contactPreference: "WHATSAPP",
        consentData: true,
        consentFarmStory,
        consentAt: ist(addDays(today, -40), 11),
        isDemo: true,
        crops: {
          create: crops.map((c) => ({
            crop: c.crop,
            stage: c.stage,
            expectedQtyKg: c.expectedQtyKg,
            expectedHarvestDate: ist(addDays(today, c.harvestInDays), 7),
          })),
        },
      },
    });
  }
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 8);
  for (const u of DEMO_USERS) await db.user.create({ data: { ...u, passwordHash, isDemo: true } });

  await seedSales(db);

  // Offers built from the computed forecast, so every number is consistent.
  const forecast = await buildForecast(db);
  const byIng = new Map(forecast.ingredients.map((i) => [i.ingredientId, i]));
  const weekStart = new Date(`${FORECAST_START}T00:00:00Z`);
  const neededBy = ist(addDays(FORECAST_START, 1), 9);

  async function currentOffer(ingredientId: string, commits: { farmerId: string; qty: number | "all" }[], sentDaysAgo: number) {
    const f = byIng.get(ingredientId)!;
    const ing = DEMO_INGREDIENTS.find((i) => i.id === ingredientId)!;
    const snapshot = await db.demandForecast.create({
      data: {
        ingredientId, weekStart, forecastQty: f.forecast, bufferQty: f.buffer, stockQty: f.stock,
        suggestedQty: f.suggested, method: forecast.method, breakdown: f.contributions as unknown as Prisma.InputJsonValue,
      },
    });
    const committed = commits.reduce((a, c) => a + (c.qty === "all" ? f.suggested : c.qty), 0);
    const offer = await db.demandOffer.create({
      data: {
        ingredientId, forecastId: snapshot.id, fpoId: DEMO_FPO_ID, quantity: f.suggested, pricePerKg: ing.pricePerKg,
        neededBy, status: committed >= f.suggested ? "ACCEPTED" : committed > 0 ? "PARTIALLY_COMMITTED" : "OFFERED",
        createdById: "user-cafe", sentAt: ist(addDays(today, -sentDaysAgo), 10), isDemo: true,
      },
    });
    for (const c of commits) {
      await db.farmerCommitment.create({
        data: {
          offerId: offer.id, farmerId: c.farmerId, quantity: c.qty === "all" ? f.suggested : c.qty, status: "COMMITTED", source: "CHAT",
          createdAt: ist(addDays(today, -sentDaysAgo), 11), updatedAt: ist(addDays(today, -sentDaysAgo), 11),
        },
      });
    }
    return offer;
  }

  const tomatoOffer = await currentOffer("tomato", [{ farmerId: "farmer-ganesh", qty: 25 }], 1);
  const spinachOffer = await currentOffer("spinach", [{ farmerId: "farmer-lakshmi", qty: "all" }], 1);

  // Last week's tomato order: fulfilled, delivered, paid (simulated).
  const lastWeek = addDays(FORECAST_START, -7);
  const prevOffer = await db.demandOffer.create({
    data: {
      ingredientId: "tomato", fpoId: DEMO_FPO_ID, quantity: 30, pricePerKg: 32, neededBy: ist(addDays(lastWeek, 1), 9),
      status: "FULFILLED", createdById: "user-cafe", sentAt: ist(addDays(lastWeek, -1), 10), isDemo: true,
      createdAt: ist(addDays(lastWeek, -1), 10),
    },
  });
  const prevCommit = await db.farmerCommitment.create({
    data: { offerId: prevOffer.id, farmerId: "farmer-ganesh", quantity: 30, status: "COMMITTED", source: "WHATSAPP", createdAt: ist(addDays(lastWeek, -1), 11), updatedAt: ist(addDays(lastWeek, -1), 11) },
  });
  const prevBatch = await db.harvestBatch.create({
    data: {
      code: "TOM-1019", commitmentId: prevCommit.id, farmerId: "farmer-ganesh", fpoId: DEMO_FPO_ID, cafeId: "brew-room",
      crop: "tomato", harvestDate: ist(addDays(lastWeek, 0), 6), quantity: 30, mediaIds: [], prelimGrade: "A",
      gradeReasons: ["Uniform red colour", "Firm skin, no visible cracks", "Consistent size"], gradeSource: "demo",
      reviewStatus: "CONFIRMED", finalGrade: "A", pickupStatus: "PICKED_UP", deliveryStatus: "DELIVERED",
      deliveredAt: ist(addDays(lastWeek, 1), 8), isDemo: true,
    },
  });
  await db.qualityReview.create({
    data: { batchId: prevBatch.id, reviewerId: "user-admin", fromGrade: "A", toGrade: "A", reason: "Checked at pickup — matches photo.", createdAt: ist(addDays(lastWeek, 0), 14) },
  });
  await db.payment.create({
    data: {
      offerId: prevOffer.id, amount: 960, provider: "SIMULATED", providerOrderId: `sim_${prevOffer.id}`,
      status: "PAID", lastVerifiedAt: ist(addDays(lastWeek, 2), 12), createdAt: ist(addDays(lastWeek, 2), 11),
    },
  });
  await db.payout.create({
    data: { commitmentId: prevCommit.id, farmerId: "farmer-ganesh", amount: 960, provider: "simulated", status: "SIMULATED", reference: "SIM-TOM-1019" },
  });

  // Conversations.
  const offerPayload = (offerId: string, ingredientId: string) => ({ offerId, ingredientId });
  for (const f of DEMO_FARMERS) {
    const msgs = CONVERSATIONS[f.id] ?? [];
    const created = msgs.map((m) => ({ ...m, at: ist(addDays(today, -m.daysAgo), m.h, m.m) }));
    const last = created[created.length - 1]?.at ?? ist(today, 9);
    const conv = await db.conversation.create({
      data: { farmerId: f.id, lastMessageAt: last, unreadCount: f.id === "farmer-sunita" ? 1 : 0 },
    });
    for (const m of created) {
      const payload =
        m.type === "OFFER"
          ? offerPayload(f.id === "farmer-ganesh" ? tomatoOffer.id : spinachOffer.id, f.id === "farmer-ganesh" ? "tomato" : "spinach")
          : undefined;
      await db.message.create({
        data: {
          conversationId: conv.id, direction: m.dir, author: m.author, type: m.type ?? "TEXT", body: m.body,
          translation: m.translation, language: f.language, payload, status: m.status ?? "READ", createdAt: m.at,
        },
      });
    }
  }

  await db.auditLog.createMany({
    data: [
      { actorId: "user-cafe", actorName: "Neha Kapoor", actorRole: "CAFE_MANAGER", action: "offer.sent", entityType: "DemandOffer", entityId: tomatoOffer.id, detail: { ingredient: "tomato", quantity: tomatoOffer.quantity }, createdAt: ist(addDays(today, -1), 10) },
      { actorId: "user-cafe", actorName: "Neha Kapoor", actorRole: "CAFE_MANAGER", action: "offer.sent", entityType: "DemandOffer", entityId: spinachOffer.id, detail: { ingredient: "spinach", quantity: spinachOffer.quantity }, createdAt: ist(addDays(today, -1), 11, 20) },
      { actorId: null, actorName: "Ganesh Valvi", actorRole: "FARMER", action: "commitment.saved", entityType: "DemandOffer", entityId: tomatoOffer.id, detail: { quantity: 25 }, createdAt: ist(addDays(today, -1), 10, 12) },
      { actorId: null, actorName: "Lakshmi Bhoir", actorRole: "FARMER", action: "commitment.saved", entityType: "DemandOffer", entityId: spinachOffer.id, detail: { quantity: spinachOffer.quantity }, createdAt: ist(addDays(today, -1), 11, 45) },
      { actorId: "user-admin", actorName: "Aarav Shah", actorRole: "ADMIN", action: "payout.simulated", entityType: "Payout", entityId: prevCommit.id, detail: { amount: 960, note: "Simulated payout — no money moved." }, createdAt: ist(addDays(lastWeek, 2), 12) },
    ].map((a) => ({ ...a, isDemo: true })),
  });
}
