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
    .select("id, username, name, role, password_hash")
    .eq("username", username)
    .maybeSingle();

  if (error || !user || !user.password_hash) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
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
  } catch {
    // Ignore if cookies() store is read-only in certain phases
  }

  return response;
}
