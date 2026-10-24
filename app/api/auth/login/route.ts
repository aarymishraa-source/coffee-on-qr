import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ApiError, ok, parseJson, route } from "@/lib/api";
import { createSession } from "@/server/auth/session";
import { ROLE_HOME } from "@/server/auth/types";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const POST = route(async (req: Request) => {
  const { email, password } = await parseJson(req, schema);
  const db = await getDb();
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, "invalid_credentials", "That email and password don't match.");
  }
  await createSession(user.id);
  return ok({ name: user.name, role: user.role, home: ROLE_HOME[user.role] });
});
