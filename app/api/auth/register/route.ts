import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { hashPassword, createSessionToken, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = (body?.username || "").trim().toLowerCase();
  const password = body?.password || "";
  const confirmPassword = body?.confirmPassword || "";

  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters." },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9_.]+$/.test(username)) {
    return NextResponse.json(
      { error: "Username can only contain letters, numbers, dots and underscores." },
      { status: 400 }
    );
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const password_hash = await hashPassword(password);

  const { data: created, error } = await db
    .from("users")
    .insert({ username, password_hash })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }

  const token = await createSessionToken(created.id);
  const cookieOpts = sessionCookieOptions();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...cookieOpts,
    value: token,
  });

  try {
    cookies().set({ ...cookieOpts, value: token });
  } catch {}

  return response;
}
