import { afterEach, beforeAll, describe, expect, test } from "vitest";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { actorFor, createTestDb } from "../helpers/db";
import { __setModelForTests } from "@/server/integrations/langchain/model";
import { __setSpeechForTests, type SpeechProvider } from "@/server/integrations/speech/providers";
import { saveMedia, validateMedia } from "@/server/services/media.service";
import { analyseCropPhoto, requestExpertReview } from "@/server/services/crop-analysis.service";
import { handleVoiceNote } from "@/server/services/voice.service";
import { sendOffer } from "@/server/services/demand.service";
import { respondToOffer } from "@/server/services/order.service";
import { actOnBatch, createBatch, getFarmStory } from "@/server/services/quality.service";
import type { CropAnalysisResult } from "@/server/assistant/schemas";

let db: PrismaClient;
beforeAll(async () => {
  db = await createTestDb();
});
afterEach(() => {
  __setModelForTests(null);
  __setSpeechForTests(null);
});

const photo = (kb: number) => Buffer.alloc(kb * 1024, 7);

/** A stand-in vision model: records what it was sent, returns a fixed structured result. */
function fakeVisionModel(result: unknown, seen: unknown[]) {
  return {
    withStructuredOutput: () => ({
      invoke: async (messages: unknown) => {
        seen.push(messages);
        return result;
      },
    }),
  } as unknown as BaseChatModel;
}

describe("crop photo understanding", () => {
  test("rejects wrong types and oversized files", () => {
    expect(() => validateMedia("image", "image/gif", 1000)).toThrow(/JPEG, PNG or WebP/);
    expect(() => validateMedia("image", "image/jpeg", 9 * 1024 * 1024)).toThrow(/8 MB/);
    expect(validateMedia("image", "image/webp", 1000)).toBe("image/webp");
  });

  test("no key → clearly labelled demo analysis, persisted and posted to the chat", async () => {
    __setModelForTests(null);
    const ramesh = await actorFor(db, "user-ramesh");
    const media = await saveMedia(db, { kind: "image", mimeType: "image/jpeg", bytes: photo(40), isDemo: true });
    const r = await analyseCropPhoto(db, ramesh, { farmerId: "farmer-ramesh", mediaId: media.id, clientKey: "photo-1-abcdef" });
    expect(r.isDemo).toBe(true);
    const a = await db.cropAnalysis.findUniqueOrThrow({ where: { id: r.analysisId! } });
    expect(a.provider).toBe("demo");
    expect((a.result as CropAnalysisResult).limitations).toMatch(/डेमो विश्लेषण/); // Marathi, labelled demo
    const card = await db.message.findFirst({ where: { type: "CROP_ANALYSIS", conversation: { farmerId: "farmer-ramesh" } }, orderBy: { createdAt: "desc" } });
    expect(card?.isDemoReply).toBe(true);
    // Retried upload with the same key does nothing.
    const again = await analyseCropPhoto(db, ramesh, { farmerId: "farmer-ramesh", mediaId: media.id, clientKey: "photo-1-abcdef" });
    expect(again.duplicate).toBe(true);
  });

  test("tiny photo → asks for a clearer one, no guess", async () => {
    const ramesh = await actorFor(db, "user-ramesh");
    const media = await saveMedia(db, { kind: "image", mimeType: "image/png", bytes: photo(3), isDemo: true });
    const r = await analyseCropPhoto(db, ramesh, { farmerId: "farmer-ramesh", mediaId: media.id });
    expect(r.result?.image_usable).toBe(false);
    expect(r.result?.possible_causes).toEqual([]);
  });

  test("with a model → the actual image is sent and the validated result stored", async () => {
    const seen: unknown[] = [];
    const result: CropAnalysisResult = {
      image_usable: true, crop: "बेसिल", symptoms_observed: ["तपकिरी ठिपके"],
      possible_causes: [{ name: "बुरशी", confidence: "medium", evidence: "गोल ठिपके" }],
      first_steps: ["बाधित पाने काढा"], info_needed: [], expert_review_recommended: true, limitations: "निश्चित निदान नाही",
    };
    __setModelForTests(fakeVisionModel(result, seen));
    const ramesh = await actorFor(db, "user-ramesh");
    const media = await saveMedia(db, { kind: "image", mimeType: "image/jpeg", bytes: photo(40), isDemo: true });
    const r = await analyseCropPhoto(db, ramesh, { farmerId: "farmer-ramesh", mediaId: media.id });
    expect(r.isDemo).toBe(false);
    const sent = JSON.stringify(seen[0]);
    expect(sent).toContain("data:image/jpeg;base64,");
    expect(sent).toContain("basil"); // crop context from the profile
    expect((await db.cropAnalysis.findUniqueOrThrow({ where: { id: r.analysisId! } })).provider).toBe("test");
  });

  test("a model returning an invalid shape falls back to a labelled demo result", async () => {
    __setModelForTests(fakeVisionModel({ nonsense: true }, []));
    const ramesh = await actorFor(db, "user-ramesh");
    const media = await saveMedia(db, { kind: "image", mimeType: "image/jpeg", bytes: photo(40), isDemo: true });
    const r = await analyseCropPhoto(db, ramesh, { farmerId: "farmer-ramesh", mediaId: media.id });
    expect(r.isDemo).toBe(true);
  });

  test("expert review is requested once and audited; other farmers can't see the analysis", async () => {
    const ramesh = await actorFor(db, "user-ramesh");
    const sunita = await actorFor(db, "user-sunita");
    const a = await db.cropAnalysis.findFirstOrThrow({ where: { farmerId: "farmer-ramesh" } });
    await expect(requestExpertReview(db, sunita, a.id)).rejects.toThrow(/not found/i);
    expect((await requestExpertReview(db, ramesh, a.id)).alreadyRequested).toBe(false);
    expect((await requestExpertReview(db, ramesh, a.id)).alreadyRequested).toBe(true);
    expect(await db.auditLog.count({ where: { action: "expert.requested", entityId: a.id } })).toBe(1);
  });
});

describe("voice notes", () => {
  test("server speech provider → transcript → assistant reply (and offer answer)", async () => {
    const cafe = await actorFor(db, "user-cafe");
    await sendOffer(db, cafe, { ingredientId: "basil", fpoId: "palghar-kisan-fpo" });
    const calls: string[] = [];
    const fake: SpeechProvider = {
      name: "fake",
      transcribe: async (_b, mime, lang) => (calls.push(`${mime}:${lang}`), "मी 6 किलो देऊ शकतो"),
      synthesize: async () => ({ bytes: Buffer.from("x"), mimeType: "audio/wav" }),
    };
    __setSpeechForTests(fake);
    const ramesh = await actorFor(db, "user-ramesh");
    const r = await handleVoiceNote(db, ramesh, { farmerId: "farmer-ramesh", bytes: Buffer.alloc(2048, 1), mimeType: "audio/webm", clientKey: "voice-ramesh-1" });
    expect(calls).toEqual(["audio/webm:mr"]);
    expect(r.transcriptSource).toBe("server");
    expect(r.reply?.body).toMatch(/6 किलो/);
    const inbound = await db.message.findFirstOrThrow({ where: { clientKey: "voice-ramesh-1" } });
    expect(inbound.type).toBe("AUDIO");
    expect(inbound.mediaId).not.toBeNull();
    const c = await db.farmerCommitment.findFirstOrThrow({ where: { farmerId: "farmer-ramesh", offer: { ingredientId: "basil" } } });
    expect(c).toMatchObject({ quantity: 6, source: "VOICE" });
  });

  test("no provider and no browser transcript → stored, farmer asked to type, nothing invented", async () => {
    __setSpeechForTests(null);
    const sunita = await actorFor(db, "user-sunita");
    const r = await handleVoiceNote(db, sunita, { farmerId: "farmer-sunita", bytes: Buffer.alloc(2048, 1), mimeType: "audio/ogg" });
    expect(r.transcript).toBeNull();
    expect(r.reply?.body).toMatch(/लिखकर/);
  });

  test("browser transcript is used (and labelled) when the server has no provider", async () => {
    const sunita = await actorFor(db, "user-sunita");
    const r = await handleVoiceNote(db, sunita, { farmerId: "farmer-sunita", bytes: Buffer.alloc(2048, 1), mimeType: "audio/webm", clientTranscript: "पेमेंट कब आएगा?" });
    expect(r.transcriptSource).toBe("browser");
    expect(r.reply?.isDemoReply).toBe(true);
  });
});

describe("harvest batches and quality", () => {
  test("batch linked to the commitment, grade correction audited, delivery fulfils the order, Farm Story respects consent", async () => {
    const offer = await db.demandOffer.findFirstOrThrow({ where: { ingredientId: "basil", status: { not: "FULFILLED" } } });
    const sunita = await actorFor(db, "user-sunita");
    await respondToOffer(db, sunita, { offerId: offer.id, farmerId: "farmer-sunita", action: "accept", source: "CHAT" });
    const ramesh = await actorFor(db, "user-ramesh");
    const cafe = await actorFor(db, "user-cafe");

    await expect(createBatch(db, ramesh, { offerId: offer.id, farmerId: "farmer-ramesh", quantity: 7, harvestDate: "2026-10-28" })).rejects.toThrow(/left to log/);
    await expect(createBatch(db, cafe, { offerId: offer.id, farmerId: "farmer-ramesh", quantity: 6, harvestDate: "2026-10-28" })).rejects.toThrow(/log harvests/);
    const b1 = await createBatch(db, ramesh, { offerId: offer.id, farmerId: "farmer-ramesh", quantity: 6, harvestDate: "2026-10-28" });
    expect(b1).toMatchObject({ prelimGrade: "A", gradeSource: "demo", reviewStatus: "PENDING" });

    await expect(actOnBatch(db, ramesh, b1.id, { action: "deliver" })).rejects.toThrow(/staff/);
    await expect(actOnBatch(db, cafe, b1.id, { action: "deliver" })).rejects.toThrow(/Confirm or correct/);
    await actOnBatch(db, cafe, b1.id, { action: "review", grade: "B", reason: "A few bruised leaves at pickup" });
    const reviewed = await db.harvestBatch.findUniqueOrThrow({ where: { id: b1.id } });
    expect(reviewed).toMatchObject({ reviewStatus: "CORRECTED", finalGrade: "B", prelimGrade: "A" });
    expect(await db.auditLog.count({ where: { action: "grade.corrected", entityId: b1.id } })).toBe(1);
    await actOnBatch(db, cafe, b1.id, { action: "deliver" });

    const s = await getFarmStory(db, "pesto-paneer-sandwich");
    expect(s).toMatchObject({ farmerName: "Ramesh Patil", village: "Safale", grade: "B" });
    expect(s!.distanceKm).toBeGreaterThan(40);

    expect((await db.demandOffer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe("ACCEPTED");
    const b2 = await createBatch(db, sunita, { offerId: offer.id, farmerId: "farmer-sunita", quantity: 4, harvestDate: "2026-10-29" });
    await actOnBatch(db, cafe, b2.id, { action: "review", grade: "A", reason: "Matches photo" });
    await actOnBatch(db, cafe, b2.id, { action: "deliver" });
    expect((await db.demandOffer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe("FULFILLED");

    // Without consent, no Farm Story is shown.
    await db.farmer.update({ where: { id: "farmer-ramesh" }, data: { consentFarmStory: false } });
    await db.farmer.update({ where: { id: "farmer-sunita" }, data: { consentFarmStory: false } });
    expect(await getFarmStory(db, "pesto-paneer-sandwich")).toBeNull();
  });
});
