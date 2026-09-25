import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName } from "@/lib/auth";

export async function POST() {
  const cookieName = sessionCookieName();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: cookieName,
    value: "",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  try {
    cookies().set({
      name: cookieName,
      value: "",
      path: "/",
      maxAge: 0,
    });
  } catch {}
  return response;
}
