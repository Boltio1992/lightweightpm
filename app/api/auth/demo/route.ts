import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const db = supabaseAdmin();
  const { data: user } = await db
    .from("users")
    .select("id, username, name, role")
    .eq("username", "admin")
    .maybeSingle();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=demo_unavailable", req.url));
  }

  const token = await createSessionToken(user.id);
  const cookieOpts = sessionCookieOptions();

  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  response.cookies.set({
    ...cookieOpts,
    value: token,
  });

  try {
    cookies().set({ ...cookieOpts, value: token });
  } catch {}

  return response;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const requestedUser = body?.user || "admin";

  const db = supabaseAdmin();
  const { data: user } = await db
    .from("users")
    .select("id, username, name, role")
    .eq("username", requestedUser === "demo" ? "admin" : requestedUser)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "Demo user not found" }, { status: 404 });
  }

  const token = await createSessionToken(user.id);
  const cookieOpts = sessionCookieOptions();

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    },
  });

  response.cookies.set({
    ...cookieOpts,
    value: token,
  });

  try {
    cookies().set({ ...cookieOpts, value: token });
  } catch {}

  return response;
}
