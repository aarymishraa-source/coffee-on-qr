import { getDb } from "@/lib/db";
import { ApiError, ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { assertFarmerAccess } from "@/server/auth/access";
import { createBatch, createBatchSchema, listBatches } from "@/server/services/quality.service";
import { saveMedia, MAX_IMAGE_BYTES } from "@/server/services/media.service";

export const GET = route(async () => {
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER", "FPO_MANAGER"]);
  return ok(await listBatches(await getDb(), actor));
});

// Multipart: offerId, farmerId, quantity, harvestDate, optional file (harvest photo).
export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  const form = await req.formData();
  const db = await getDb();
  const farmerId = String(form.get("farmerId") ?? "");
  await assertFarmerAccess(db, actor, farmerId);
  let mediaId: string | undefined;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) throw new ApiError(413, "too_large", "Photos must be 8 MB or smaller.");
    const farmer = await db.farmer.findUniqueOrThrow({ where: { id: farmerId } });
    mediaId = (await saveMedia(db, { kind: "image", mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()), isDemo: farmer.isDemo })).id;
  }
  const input = createBatchSchema.parse({
    offerId: form.get("offerId"),
    farmerId,
    quantity: Number(form.get("quantity")),
    harvestDate: form.get("harvestDate"),
    mediaId,
  });
  const batch = await createBatch(db, actor, input);
  return ok({ id: batch.id, code: batch.code, prelimGrade: batch.prelimGrade, gradeSource: batch.gradeSource });
});
