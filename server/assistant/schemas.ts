import { z } from "zod";

// Structured outputs the models must return (validated with Zod).
// Keep these within the subset every provider accepts: Gemini rejects
// nullable unions (type: ["string", "null"]) and exclusive bounds, so optional
// or empty values are normalised after parsing instead.

export const assistantReplySchema = z.object({
  reply: z.string().describe("The reply to send to the farmer, in the farmer's language, plain and short."),
  farmer_message_english: z
    .string()
    .describe("An English translation of the farmer's latest message, or the same text if it was already English."),
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;

export const cropAnalysisSchema = z.object({
  image_usable: z.boolean().describe("False if the photo is too blurry, dark, far or not a plant to assess."),
  crop: z.string().describe("Crop or plant if identifiable, else an empty string."),
  symptoms_observed: z.array(z.string()).describe("Visible symptoms only — what can actually be seen."),
  possible_causes: z
    .array(
      z.object({
        name: z.string(),
        confidence: z.enum(["low", "medium", "high"]),
        evidence: z.string().describe("Which visible features support this."),
      })
    )
    .max(4),
  first_steps: z.array(z.string()).describe("Safe, non-chemical first steps. Never name pesticides or doses."),
  info_needed: z.array(z.string()).describe("What else would help (other photos, history, field details)."),
  expert_review_recommended: z.boolean(),
  limitations: z.string().describe("What a photo cannot tell; state that this is not a confirmed diagnosis."),
});
export type CropAnalysisResult = Omit<z.infer<typeof cropAnalysisSchema>, "crop"> & { crop: string | null };

/** Validates a model's crop assessment; an empty crop name becomes null. */
export function parseCropAnalysis(raw: unknown): CropAnalysisResult {
  const r = cropAnalysisSchema.parse(raw);
  return { ...r, crop: r.crop.trim() || null };
}

export const gradeSchema = z.object({
  image_usable: z.boolean(),
  grade: z.enum(["A", "B", "C"]).describe("A: uniform, fresh, no visible damage. B: minor blemishes. C: visible damage or wilting."),
  reasons: z.array(z.string()).min(1).max(4),
});
export type GradeResult = z.infer<typeof gradeSchema>;
