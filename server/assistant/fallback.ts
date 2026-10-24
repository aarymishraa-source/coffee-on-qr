import "server-only";
import { T, fmtQty, type Lang } from "@/server/services/i18n";
import {
  escalateToExpert, getActiveOrder, getHarvestPlan, getLatestCropAnalysis, getPaymentStatus, respondToActiveOffer,
  searchAgriKnowledge, type AssistantContext,
} from "./business-tools";
import type { CropAnalysisResult } from "./schemas";

// Deterministic assistant used when no model key is configured. It matches a
// handful of intents and answers only from records and the curated knowledge
// file. Every reply it produces is labelled "Demo reply" in the UI.

const DEVANAGARI_DIGITS = "०१२३४५६७८९";
export function normaliseDigits(s: string) {
  return s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`(^|[\\s,.!?।])${w}($|[\\s,.!?।])`, "i").test(text));

const YES = ["yes", "accept", "ok", "okay", "हाँ", "हां", "हा", "हो", "होय", "जी", "all", "सब", "सगळा", "सगळं", "पूरा", "पूर्ण"];
const NO = ["no", "decline", "नहीं", "नही", "नाही", "नको", "can't", "cannot"];
const PAYMENT = ["payment", "paid", "pay", "money", "पैसे", "पैसा", "पेमेंट", "भुगतान", "पेमेंट?"];
const EXPERT = ["expert", "विशेषज्ञ", "तज्ज्ञ", "तज्ञ", "agronomist"];
const HARVEST_PLAN = ["harvest plan", "my harvest", "कटाई कब", "काढणी कधी", "फसल कब"];
const ORDER = ["order", "ऑर्डर", "मागणी", "offer"];
const PHOTO = ["photo", "picture", "image", "leaf", "फ़ोटो", "फोटो", "पत्ता", "पत्ते", "पान", "result", "what is it", "क्या है", "काय आहे"];

export interface FallbackReply {
  reply: string;
  action?: { kind: "commitment"; offerId: string; outcome: string };
}

export async function fallbackReply(ctx: AssistantContext, rawText: string): Promise<FallbackReply> {
  const text = normaliseDigits(rawText.trim());
  const lang = ctx.language;
  const lower = text.toLowerCase();

  // 1. Answers to an open offer: a quantity, yes, or no.
  const offers = await getActiveOrder(ctx);
  const open = offers.find((o) => o.openKg > 0);
  const qtyMatch = lower.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|किलो|kilo|केजी|किग्रा)?/);
  const short = lower.split(/\s+/).length <= 6 && !lower.includes("?");
  if (open && qtyMatch && (qtyMatch[2] || short)) {
    const r = await respondToActiveOffer(ctx, { offerId: open.offerId, action: "commit", quantityKg: Number(qtyMatch[1]) });
    return reply(r);
  }
  if (open && short && has(lower, YES) && !has(lower, NO)) {
    const r = await respondToActiveOffer(ctx, { offerId: open.offerId, action: "accept" });
    return reply(r);
  }
  if (open && short && has(lower, NO)) {
    const r = await respondToActiveOffer(ctx, { offerId: open.offerId, action: "decline" });
    return reply(r);
  }

  // 2. Expert escalation.
  if (has(lower, EXPERT) || lower.includes("expert")) {
    return { reply: (await escalateToExpert(ctx, `Farmer asked: "${rawText.slice(0, 200)}"`)).message };
  }

  // 3. Payments.
  if (PAYMENT.some((w) => lower.includes(w))) return { reply: paymentText(lang, await getPaymentStatus(ctx)) };

  // 4. Follow-up on the latest crop photo.
  const analysis = await getLatestCropAnalysis(ctx);
  if (analysis && PHOTO.some((w) => lower.includes(w))) {
    return { reply: analysisFollowUp(lang, analysis.result as CropAnalysisResult) };
  }

  // 5. Harvest plan.
  if (HARVEST_PLAN.some((w) => lower.includes(w))) return { reply: harvestText(lang, await getHarvestPlan(ctx)) };

  // 6. Curated knowledge.
  const hits = searchAgriKnowledge(ctx, lower);
  if (hits.length) return { reply: `${hits[0].guidance} (${sourceLabel(lang)})` };

  // 7. Order status.
  if (ORDER.some((w) => lower.includes(w))) {
    if (!offers.length) return { reply: T.noActiveOrder(lang) };
    const o = offers[0];
    return { reply: orderText(lang, o) };
  }

  return { reply: T.dontKnow(lang) };
}

function reply(r: Awaited<ReturnType<typeof respondToActiveOffer>>): FallbackReply {
  if (!r.ok) return { reply: r.message };
  return { reply: r.message ?? "", action: { kind: "commitment", offerId: r.offerId, outcome: r.outcome.kind } };
}

function sourceLabel(lang: Lang) {
  return { en: "Source: Kisan Sahayak general crop-care notes", hi: "स्रोत: Kisan Sahayak सामान्य फसल-देखभाल नोट्स", mr: "स्रोत: Kisan Sahayak सामान्य पीक-काळजी नोंदी" }[lang];
}

function orderText(lang: Lang, o: Awaited<ReturnType<typeof getActiveOrder>>[number]) {
  const mine = o.yourCommitmentKg;
  return {
    en: `${o.ingredient}: ${fmtQty(o.totalKg)} kg ordered, ${fmtQty(o.openKg)} kg still open. ${mine ? `You've committed ${fmtQty(mine)} kg.` : "You haven't committed yet — reply with how many kg you can supply."}`,
    hi: `${o.ingredient}: ${fmtQty(o.totalKg)} किलो का ऑर्डर, ${fmtQty(o.openKg)} किलो अभी बाकी। ${mine ? `आपने ${fmtQty(mine)} किलो देने का वादा किया है।` : "आपने अभी जवाब नहीं दिया — बताइए कितने किलो दे सकते हैं।"}`,
    mr: `${o.ingredient}: ${fmtQty(o.totalKg)} किलोची मागणी, ${fmtQty(o.openKg)} किलो अजून बाकी. ${mine ? `तुम्ही ${fmtQty(mine)} किलो देण्याचे कबूल केले आहे.` : "तुम्ही अजून उत्तर दिलेले नाही — किती किलो देऊ शकता ते सांगा."}`,
  }[lang];
}

function paymentText(lang: Lang, rows: Awaited<ReturnType<typeof getPaymentStatus>>) {
  if (!rows.length) {
    return {
      en: "No payments are due to you yet. Payment is recorded after your harvest is delivered and checked.",
      hi: "अभी आपका कोई भुगतान बाकी नहीं है। फसल पहुँचने और जाँच के बाद भुगतान दर्ज होता है।",
      mr: "अजून तुमचे कोणतेही पेमेंट बाकी नाही. माल पोहोचून तपासणी झाल्यावर पेमेंट नोंदवले जाते.",
    }[lang];
  }
  const p = rows[0];
  const sim = p.simulated;
  return {
    en: `${p.ingredient} (${fmtQty(p.quantityKg)} kg): ₹${p.amount}. Status: ${sim ? "simulated in this demo — no money has moved" : p.payoutStatus.toLowerCase()}.`,
    hi: `${p.ingredient} (${fmtQty(p.quantityKg)} किलो): ₹${p.amount}। स्थिति: ${sim ? "यह डेमो में सिम्युलेटेड है — कोई पैसा ट्रांसफ़र नहीं हुआ" : p.payoutStatus.toLowerCase()}।`,
    mr: `${p.ingredient} (${fmtQty(p.quantityKg)} किलो): ₹${p.amount}. स्थिती: ${sim ? "हा डेमोमधील सिम्युलेशन आहे — कोणतेही पैसे पाठवलेले नाहीत" : p.payoutStatus.toLowerCase()}.`,
  }[lang];
}

function harvestText(lang: Lang, plan: Awaited<ReturnType<typeof getHarvestPlan>>) {
  const lines = plan.crops
    .filter((c) => c.expectedHarvestDate)
    .map((c) => `${c.crop}: ${c.expectedHarvestDate}${c.expectedQtyKg ? ` (~${fmtQty(c.expectedQtyKg)} kg)` : ""}`)
    .join("; ");
  return { en: `Your expected harvests: ${lines}.`, hi: `आपकी अनुमानित कटाई: ${lines}।`, mr: `तुमची अपेक्षित काढणी: ${lines}.` }[lang];
}

function analysisFollowUp(lang: Lang, r: CropAnalysisResult) {
  const cause = r.possible_causes[0];
  const steps = r.first_steps.slice(0, 2).join("; ");
  if (!cause) return T.photoUnclear(lang);
  return {
    en: `From your last photo, a possible cause is ${cause.name} (${cause.confidence} confidence) — this is not a confirmed diagnosis. First steps: ${steps}. Reply "expert" to have an expert check it.`,
    hi: `आपकी पिछली फ़ोटो से संभावित कारण ${cause.name} (${cause.confidence} भरोसा) है — यह पक्का निदान नहीं है। पहले कदम: ${steps}। विशेषज्ञ से जाँच के लिए "विशेषज्ञ" लिखें।`,
    mr: `तुमच्या मागच्या फोटोवरून संभाव्य कारण ${cause.name} (${cause.confidence} खात्री) आहे — हे निश्चित निदान नाही. पहिली पावले: ${steps}. तज्ज्ञांकडून तपासणीसाठी "तज्ज्ञ" लिहा.`,
  }[lang];
}
