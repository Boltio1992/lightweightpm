import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName } from "@/lib/auth";

export async function POST() {
  cookies().set({
    name: sessionCookieName(),
    value: "",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
