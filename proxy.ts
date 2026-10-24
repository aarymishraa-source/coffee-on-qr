import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/token";

// First line of defence: signed-out visitors to the supply console or the
// Kisan module go to /login. Role checks happen in pages (requirePage) and
// again in every API route — this only checks that a valid session exists.
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySession(token))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/console/supply/:path*", "/console/settings/:path*", "/kisan/:path*", "/kisan"],
};
