import "server-only";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { isConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { Actor } from "@/server/auth/types";
import { assertFarmerAccess, canReviewQuality } from "@/server/auth/access";
import { signedCloudinaryUrl, uploadToCloudinary } from "@/server/integrations/cloudinary/client";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/aac", "audio/amr"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

export function validateMedia(kind: "image" | "audio", mimeType: string, size: number) {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (kind === "image") {
    if (!IMAGE_TYPES.includes(base)) throw new ApiError(415, "unsupported_type", "Send a JPEG, PNG or WebP photo.");
    if (size > MAX_IMAGE_BYTES) throw new ApiError(413, "too_large", "Photos must be 8 MB or smaller.");
  } else {
    if (!AUDIO_TYPES.includes(base)) throw new ApiError(415, "unsupported_type", "That audio format isn't supported.");
    if (size > MAX_AUDIO_BYTES) throw new ApiError(413, "too_large", "Voice notes must be 16 MB or smaller.");
  }
  if (size === 0) throw new ApiError(400, "empty_file", "The file is empty.");
  return base;
}

/**
 * Stores media in Cloudinary when configured, otherwise in the database
 * (works on any host, fine for demo volumes).
 */
export async function saveMedia(db: Db, input: { kind: "image" | "audio"; mimeType: string; bytes: Buffer; isDemo: boolean }) {
  const mimeType = validateMedia(input.kind, input.mimeType, input.bytes.length);
  if (isConfigured.cloudinary()) {
    try {
      const up = await uploadToCloudinary(input.bytes, { kind: input.kind });
      return db.media.create({
        data: { kind: input.kind, mimeType, bytes: input.bytes.length, storage: "cloudinary", url: up.publicId, isDemo: input.isDemo },
      });
    } catch (err) {
      logger.warn("media: cloudinary upload failed, storing in database", { error: err instanceof Error ? err.message : String(err) });
    }
  }
  return db.media.create({
    data: { kind: input.kind, mimeType, bytes: input.bytes.length, storage: "database", data: new Uint8Array(input.bytes), isDemo: input.isDemo },
  });
}

export async function readMediaBytes(db: Db, id: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const m = await db.media.findUnique({ where: { id } });
  if (!m) throw new ApiError(404, "not_found", "Media not found.");
  if (m.storage === "database" && m.data) return { bytes: Buffer.from(m.data), mimeType: m.mimeType };
  const res = await fetch(signedCloudinaryUrl(m.url!, m.kind as "image" | "audio"));
  if (!res.ok) throw new ApiError(502, "media_unavailable", "Couldn't fetch the stored file.");
  return { bytes: Buffer.from(await res.arrayBuffer()), mimeType: m.mimeType };
}

/** Only people who can see the owning farmer (or quality reviewers, for batch photos) may view media. */
export async function assertMediaAccess(db: Db, actor: Actor, mediaId: string) {
  const msg = await db.message.findFirst({ where: { mediaId }, include: { conversation: true } });
  if (msg) return assertFarmerAccess(db, actor, msg.conversation.farmerId);
  const img = await db.cropImage.findFirst({ where: { mediaId } });
  if (img) return assertFarmerAccess(db, actor, img.farmerId);
  const batch = await db.harvestBatch.findFirst({ where: { mediaIds: { has: mediaId } } });
  if (batch) {
    if (canReviewQuality(actor)) return;
    return assertFarmerAccess(db, actor, batch.farmerId);
  }
  throw new ApiError(404, "not_found", "Media not found.");
}

export function toDataUrl(bytes: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}
