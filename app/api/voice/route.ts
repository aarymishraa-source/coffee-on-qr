import { z } from "zod";
import { getDb } from "@/lib/db";
import { ApiError, ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { handleVoiceNote } from "@/server/services/voice.service";
import { MAX_AUDIO_BYTES } from "@/server/services/media.service";

const fields = z.object({
  farmerId: z.string().min(1),
  clientTranscript: z.string().max(2000).optional(),
  clientKey: z.string().min(8).max(200),
});

export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "file_required", "Record or attach a voice note.");
  if (file.size > MAX_AUDIO_BYTES) throw new ApiError(413, "too_large", "Voice notes must be 16 MB or smaller.");
  const input = fields.parse({
    farmerId: form.get("farmerId"),
    clientTranscript: form.get("clientTranscript") || undefined,
    clientKey: form.get("clientKey"),
  });
  const r = await handleVoiceNote(await getDb(), actor, {
    ...input,
    bytes: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type || "audio/webm",
  });
  return ok({ transcript: r.transcript, transcriptSource: r.transcriptSource, replyId: r.reply?.id ?? null });
});
