import { z } from "zod";
import { getDb } from "@/lib/db";
import { ApiError, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { synthesizeMessage } from "@/server/services/voice.service";

const schema = z.object({ messageId: z.string().min(1) });

// Returns audio bytes, or a "tts_unavailable" error so the client can fall
// back to the browser's speech synthesis.
export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  const { messageId } = await parseJson(req, schema);
  const audio = await synthesizeMessage(await getDb(), actor, messageId);
  if (!audio) throw new ApiError(501, "tts_unavailable", "No server speech provider is configured.");
  return new Response(new Uint8Array(audio.bytes), {
    headers: { "Content-Type": audio.mimeType, "Cache-Control": "private, max-age=3600" },
  });
});
