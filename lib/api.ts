import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType } from "zod";
import { logger } from "@/lib/logger";

// Every API route returns { ok: true, data } or { ok: false, error }.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data } satisfies ApiResult<T>, init);
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } } satisfies ApiResult<never>, { status });
}

/** Wraps a route handler: maps ApiError / ZodError to consistent JSON errors. */
export function route<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      unstable_rethrow(err); // let Next handle its own control-flow errors (prerender bail-outs, redirects)
      if (err instanceof ApiError) return fail(err.status, err.code, err.message);
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return fail(400, "invalid_input", first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.");
      }
      logger.error("api: unhandled error", { message: err instanceof Error ? err.message : String(err) });
      return fail(500, "server_error", "Something went wrong on our side. Please try again.");
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON.");
  }
  return schema.parse(body);
}
