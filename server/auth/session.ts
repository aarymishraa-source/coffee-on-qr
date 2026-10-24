import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { signSession, verifySession, SESSION_COOKIE, SESSION_MAX_AGE } from "./token";
import type { Actor, Role } from "./types";

export async function createSession(userId: string) {
  const token = await signSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getActor(): Promise<Actor | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySession(token) : null;
  if (!userId) return null;
  const db = await getDb();
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    isDemo: u.isDemo,
    cafeId: u.cafeId,
    fpoId: u.fpoId,
    farmerId: u.farmerId,
    fieldAgentId: u.fieldAgentId,
  };
}

/** For API routes and server actions: throws 401/403 as ApiError. */
export async function requireActor(roles?: Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new ApiError(401, "unauthenticated", "Please sign in.");
  if (roles && !roles.includes(actor.role)) {
    throw new ApiError(403, "forbidden", "Your role can't do that.");
  }
  return actor;
}
