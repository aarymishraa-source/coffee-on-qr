import "server-only";
import { redirect } from "next/navigation";
import { rolesFor } from "@/features/navigation";
import { getActor } from "./session";
import type { Actor } from "./types";

/** Server-side page guard: redirects to /login, or to the forbidden page for the wrong role. */
export async function requirePage(path: string): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/login?next=${encodeURIComponent(path)}`);
  const roles = rolesFor(path);
  if (roles && !roles.includes(actor.role)) redirect(`/forbidden?from=${encodeURIComponent(path)}`);
  return actor;
}
