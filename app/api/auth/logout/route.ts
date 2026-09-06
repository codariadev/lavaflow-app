import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  
  cookieStore.set("session", "", {
    maxAge: 0,
    path: "/",
  });

  return NextResponse.json({ success: true });
}