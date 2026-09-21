import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { verifyPassword, createSessionToken, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = (body?.username || "").trim().toLowerCase();
  const password = body?.password || "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: user, error } = await db
    .from("users")
    .select("id, password_hash")
    .eq("username", username)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await createSessionToken(user.id);
  cookies().set({ ...sessionCookieOptions(), value: token });

  return NextResponse.json({ ok: true });
}
