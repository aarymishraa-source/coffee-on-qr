import "server-only";
import { z } from "zod";

// Shapes of the Cloud API webhook payload we act on. Unknown fields pass
// through; unknown message types are acknowledged and ignored.
const mediaRef = z.object({ id: z.string(), mime_type: z.string().optional(), caption: z.string().optional() }).loose();

export const waMessageSchema = z
  .object({
    from: z.string(),
    id: z.string(),
    timestamp: z.string().optional(),
    type: z.string(),
    text: z.object({ body: z.string() }).optional(),
    image: mediaRef.optional(),
    audio: mediaRef.optional(),
  })
  .loose();

export const waStatusSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    timestamp: z.string().optional(),
    recipient_id: z.string().optional(),
  })
  .loose();

export const waPayloadSchema = z
  .object({
    object: z.string(),
    entry: z.array(
      z
        .object({
          id: z.string().optional(),
          changes: z.array(
            z
              .object({
                field: z.string(),
                value: z
                  .object({
                    messages: z.array(waMessageSchema).optional(),
                    statuses: z.array(waStatusSchema).optional(),
                  })
                  .loose(),
              })
              .loose()
          ),
        })
        .loose()
    ),
  })
  .loose();

export type WaPayload = z.infer<typeof waPayloadSchema>;
export type WaMessage = z.infer<typeof waMessageSchema>;
export type WaStatus = z.infer<typeof waStatusSchema>;

export function extractEvents(payload: WaPayload) {
  const messages: WaMessage[] = [];
  const statuses: WaStatus[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      messages.push(...(change.value.messages ?? []));
      statuses.push(...(change.value.statuses ?? []));
    }
  }
  return { messages, statuses };
}

export function normalisePhone(phone: string) {
  return phone.replace(/\D/g, "");
}
