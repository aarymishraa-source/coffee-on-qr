import "server-only";
import { HumanMessage } from "@langchain/core/messages";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { Actor } from "@/server/auth/types";
import { assertFarmerAccess } from "@/server/auth/access";
import { getChatModel } from "@/server/integrations/langchain/model";
import { cropAnalysisPrompt } from "@/server/assistant/prompts";
import { cropAnalysisSchema, type CropAnalysisResult } from "@/server/assistant/schemas";
import { audit } from "./audit.service";
import { postMessage } from "./conversation.service";
import { T, type Lang } from "./i18n";
import { readMediaBytes, toDataUrl } from "./media.service";

// Below this size a phone photo is almost certainly a thumbnail or unusable.
const MIN_USEFUL_BYTES = 12 * 1024;

export interface AnalyseInput {
  farmerId: string;
  mediaId: string;
  note?: string | null;
  channel?: "PORTAL" | "WHATSAPP";
  clientKey?: string | null;
  providerMessageId?: string | null;
}

/**
 * Stores the photo against the farmer and conversation, runs a vision model
 * (when a key is configured) with Zod-validated output, persists the result
 * and posts a result card. Without a key the result is a clearly labelled
 * demo example — no model looked at the photo.
 */
export async function analyseCropPhoto(db: Db, actor: Actor, input: AnalyseInput) {
  await assertFarmerAccess(db, actor, input.farmerId);
  if (input.clientKey) {
    const dup = await db.message.findUnique({ where: { clientKey: input.clientKey } });
    if (dup) return { duplicate: true as const, analysisId: null };
  }
  const farmer = await db.farmer.findUniqueOrThrow({ where: { id: input.farmerId }, include: { crops: true } });
  const lang = farmer.language as Lang;
  const crop = farmer.crops.find((c) => c.stage !== "SOWING") ?? farmer.crops[0] ?? null;
  const media = await db.media.findUnique({ where: { id: input.mediaId } });
  if (!media || media.kind !== "image") throw new ApiError(404, "not_found", "Photo not found.");

  const image = await db.cropImage.create({
    data: { farmerId: farmer.id, mediaId: media.id, crop: crop?.crop ?? null, conversationId: (await db.conversation.findUnique({ where: { farmerId: farmer.id } }))?.id },
  });
  await postMessage(db, {
    farmerId: farmer.id,
    direction: "IN",
    author: "FARMER",
    type: "IMAGE",
    body: input.note?.trim() || "Photo",
    mediaId: media.id,
    clientKey: input.clientKey,
    providerMessageId: input.providerMessageId,
    sentByUserId: actor.role === "FARMER" || !actor.id ? null : actor.id,
    channel: input.channel,
  });

  let result: CropAnalysisResult;
  let provider = "demo";
  let isDemo = true;
  if (media.bytes < MIN_USEFUL_BYTES) {
    result = unclearResult(lang);
    provider = "size-check";
    isDemo = false;
  } else {
    const llm = await getChatModel();
    if (llm) {
      try {
        const { bytes, mimeType } = await readMediaBytes(db, media.id);
        const structured = llm.model.withStructuredOutput(cropAnalysisSchema, { name: "crop_photo_assessment" });
        result = cropAnalysisSchema.parse(
          await structured.invoke([
            new HumanMessage({
              content: [
                { type: "text", text: cropAnalysisPrompt({ language: lang, crop: crop?.crop ?? null, stage: crop?.stage ?? null, note: input.note ?? null }) },
                { type: "image_url", image_url: { url: toDataUrl(bytes, mimeType) } },
              ],
            }),
          ])
        );
        provider = llm.provider;
        isDemo = false;
      } catch (err) {
        logger.warn("crop-analysis: vision model failed, using demo result", { error: err instanceof Error ? err.message : String(err) });
        result = demoResult(lang, crop?.crop ?? null);
      }
    } else {
      result = demoResult(lang, crop?.crop ?? null);
    }
  }

  const analysis = await db.cropAnalysis.create({
    data: {
      cropImageId: image.id,
      farmerId: farmer.id,
      result: result as unknown as Prisma.InputJsonValue,
      provider,
      isDemo,
      language: lang,
    },
  });
  await postMessage(db, {
    farmerId: farmer.id,
    direction: "OUT",
    author: "ASSISTANT",
    type: "CROP_ANALYSIS",
    body: result.image_usable ? summary(lang, result) : T.photoUnclear(lang),
    payload: { analysisId: analysis.id, isDemo, provider, result } as unknown as Prisma.InputJsonValue,
    isDemoReply: isDemo,
  });
  return { duplicate: false as const, analysisId: analysis.id, isDemo, result };
}

export async function requestExpertReview(db: Db, actor: Actor, analysisId: string) {
  const a = await db.cropAnalysis.findUnique({ where: { id: analysisId } });
  if (!a) throw new ApiError(404, "not_found", "Analysis not found.");
  await assertFarmerAccess(db, actor, a.farmerId);
  if (a.expertRequestedAt) return { alreadyRequested: true };
  const farmer = await db.farmer.findUniqueOrThrow({ where: { id: a.farmerId } });
  await db.cropAnalysis.update({ where: { id: a.id }, data: { expertRequestedAt: new Date() } });
  await audit(db, actor, "expert.requested", "CropAnalysis", a.id, { farmer: farmer.name });
  await postMessage(db, { farmerId: farmer.id, direction: "OUT", author: "SYSTEM", body: T.expertRequested(farmer.language as Lang) });
  return { alreadyRequested: false };
}

function summary(lang: Lang, r: CropAnalysisResult) {
  const cause = r.possible_causes[0];
  return {
    en: `Photo checked. ${cause ? `Possible cause: ${cause.name} (${cause.confidence} confidence).` : "No clear cause visible."} This is not a confirmed diagnosis.`,
    hi: `फ़ोटो देखी गई। ${cause ? `संभावित कारण: ${cause.name} (${cause.confidence} भरोसा)।` : "कोई साफ़ कारण नहीं दिखा।"} यह पक्का निदान नहीं है।`,
    mr: `फोटो तपासला. ${cause ? `संभाव्य कारण: ${cause.name} (${cause.confidence} खात्री).` : "स्पष्ट कारण दिसले नाही."} हे निश्चित निदान नाही.`,
  }[lang];
}

function unclearResult(lang: Lang): CropAnalysisResult {
  return {
    image_usable: false,
    crop: null,
    symptoms_observed: [],
    possible_causes: [],
    first_steps: [],
    info_needed: [T.photoUnclear(lang)],
    expert_review_recommended: false,
    limitations: T.photoUnclear(lang),
  };
}

/** Fixed example shown when no vision model is configured. Always flagged isDemo. */
function demoResult(lang: Lang, crop: string | null): CropAnalysisResult {
  const c = {
    en: {
      crop: crop === "basil" ? "Basil (from your profile)" : crop ? `${crop} (from your profile)` : null,
      symptoms: ["Small brown spots on older leaves", "Slight yellowing around some spots"],
      causes: [
        { name: "Fungal leaf spot", confidence: "medium" as const, evidence: "Round brown spots with a yellow edge on lower leaves" },
        { name: "Water splash or sun scorch", confidence: "low" as const, evidence: "Spots are on leaves exposed to overhead watering" },
      ],
      steps: ["Remove the worst-affected leaves and keep them away from the field", "Water at the base in the morning, not over the leaves", "Give plants more space for airflow"],
      info: ["A photo of the underside of the leaf", "How many plants are affected", "Recent rain or watering changes"],
      limits: "Demo analysis — no AI model looked at this photo. This example shows the format a real analysis uses. A photo alone can't confirm a cause.",
    },
    hi: {
      crop: crop === "basil" ? "बेसिल (आपकी प्रोफ़ाइल से)" : crop ? `${crop} (आपकी प्रोफ़ाइल से)` : null,
      symptoms: ["पुराने पत्तों पर छोटे भूरे धब्बे", "कुछ धब्बों के चारों ओर हल्का पीलापन"],
      causes: [
        { name: "फफूंद से पत्ती धब्बा", confidence: "medium" as const, evidence: "निचले पत्तों पर पीले किनारे वाले गोल भूरे धब्बे" },
        { name: "पानी के छींटे या धूप से झुलसना", confidence: "low" as const, evidence: "धब्बे ऊपर से पानी पड़ने वाले पत्तों पर हैं" },
      ],
      steps: ["सबसे ज़्यादा प्रभावित पत्ते हटाकर खेत से दूर रखें", "सुबह जड़ में पानी दें, पत्तों पर नहीं", "पौधों के बीच हवा के लिए जगह बढ़ाएँ"],
      info: ["पत्ते के नीचे की तरफ़ की फ़ोटो", "कितने पौधे प्रभावित हैं", "हाल की बारिश या सिंचाई में बदलाव"],
      limits: "डेमो विश्लेषण — किसी AI मॉडल ने यह फ़ोटो नहीं देखी। यह उदाहरण असली विश्लेषण का प्रारूप दिखाता है। सिर्फ़ फ़ोटो से कारण पक्का नहीं होता।",
    },
    mr: {
      crop: crop === "basil" ? "बेसिल (तुमच्या प्रोफाइलवरून)" : crop ? `${crop} (तुमच्या प्रोफाइलवरून)` : null,
      symptoms: ["जुन्या पानांवर लहान तपकिरी ठिपके", "काही ठिपक्यांभोवती थोडा पिवळेपणा"],
      causes: [
        { name: "बुरशीजन्य पानावरील ठिपके", confidence: "medium" as const, evidence: "खालच्या पानांवर पिवळ्या कडेचे गोल तपकिरी ठिपके" },
        { name: "पाण्याचे शिंतोडे किंवा उन्हाचा चटका", confidence: "low" as const, evidence: "ठिपके वरून पाणी पडणाऱ्या पानांवर आहेत" },
      ],
      steps: ["सर्वाधिक बाधित पाने काढून शेतापासून दूर ठेवा", "सकाळी मुळाशी पाणी द्या, पानांवर नाही", "झाडांमध्ये हवा खेळती राहील इतके अंतर ठेवा"],
      info: ["पानाच्या खालच्या बाजूचा फोटो", "किती झाडे बाधित आहेत", "अलीकडचा पाऊस किंवा पाणी देण्यातील बदल"],
      limits: "डेमो विश्लेषण — कोणत्याही AI मॉडेलने हा फोटो पाहिलेला नाही. हे उदाहरण खऱ्या विश्लेषणाचे स्वरूप दाखवते. फक्त फोटोवरून कारण निश्चित होत नाही.",
    },
  }[lang];
  return {
    image_usable: true,
    crop: c.crop,
    symptoms_observed: c.symptoms,
    possible_causes: c.causes,
    first_steps: c.steps,
    info_needed: c.info,
    expert_review_recommended: true,
    limitations: c.limits,
  };
}
