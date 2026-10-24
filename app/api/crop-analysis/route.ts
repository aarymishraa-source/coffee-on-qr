import { z } from "zod";
import { getDb } from "@/lib/db";
import { ApiError, ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { assertFarmerAccess } from "@/server/auth/access";
import { saveMedia, MAX_IMAGE_BYTES } from "@/server/services/media.service";
import { analyseCropPhoto } from "@/server/services/crop-analysis.service";

const fields = z.object({
  farmerId: z.string().min(1),
  note: z.string().max(500).optional(),
  clientKey: z.string().min(8).max(200),
});

export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "file_required", "Attach a photo.");
  if (file.size > MAX_IMAGE_BYTES) throw new ApiError(413, "too_large", "Photos must be 8 MB or smaller.");
  const input = fields.parse({
    farmerId: form.get("farmerId"),
    note: form.get("note") || undefined,
    clientKey: form.get("clientKey"),
  });
  const db = await getDb();
  await assertFarmerAccess(db, actor, input.farmerId);
  const farmer = await db.farmer.findUniqueOrThrow({ where: { id: input.farmerId } });
  const media = await saveMedia(db, { kind: "image", mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()), isDemo: farmer.isDemo });
  const r = await analyseCropPhoto(db, actor, { ...input, mediaId: media.id });
  return ok({ analysisId: r.analysisId, isDemo: r.duplicate ? null : r.isDemo });
});
