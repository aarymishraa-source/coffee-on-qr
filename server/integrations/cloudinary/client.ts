import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

// Signed, server-side uploads only — the API secret never reaches the browser.
export async function uploadToCloudinary(bytes: Buffer, opts: { kind: "image" | "audio"; folder?: string }) {
  const e = env();
  cloudinary.config({
    cloud_name: e.CLOUDINARY_CLOUD_NAME,
    api_key: e.CLOUDINARY_API_KEY,
    api_secret: e.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      // Cloudinary stores audio under the "video" resource type.
      { folder: opts.folder ?? "kisan-sahayak", resource_type: opts.kind === "audio" ? "video" : "image", type: "authenticated" },
      (err, res) => (err || !res ? reject(err ?? new Error("Cloudinary upload failed")) : resolve({ url: res.secure_url, publicId: res.public_id }))
    );
    stream.end(bytes);
  });
}

/** Short-lived signed URL for an authenticated asset. */
export function signedCloudinaryUrl(publicId: string, kind: "image" | "audio") {
  const e = env();
  cloudinary.config({ cloud_name: e.CLOUDINARY_CLOUD_NAME, api_key: e.CLOUDINARY_API_KEY, api_secret: e.CLOUDINARY_API_SECRET, secure: true });
  return cloudinary.url(publicId, {
    resource_type: kind === "audio" ? "video" : "image",
    type: "authenticated",
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 600,
  });
}
