import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  const { pathname } = req.nextUrl;

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/adm", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/cliente/:path*", "/lavador/:path*", "/adm/:path*"],
};