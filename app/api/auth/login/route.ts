import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { verifyPassword, createSessionToken, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  let username = (body?.username || "").trim().toLowerCase();
  let password = body?.password || "";
  const isDemo = Boolean(body?.demo);

  // If demo request is sent without username, default to admin
  if (isDemo && !username) {
    username = "admin";
  }

  // Alias 'demo' to 'admin' (Alex Rivera)
  if (username === "demo") {
    username = "admin";
    if (!password) password = "password123";
  }

  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: user, error } = await db
    .from("users")
    .select("id, username, name, role, password_hash")
    .eq("username", username)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  // Known demo accounts
  const isDemoAccount = ["admin", "jane", "marcus"].includes(user.username);
  const isAcceptedDemoPassword =
    password === "password123" ||
    password === "demo" ||
    password === "admin" ||
    password === user.username ||
    (isDemo && (!password || password.length >= 0));

  let authenticated = false;
  if (isDemoAccount && isAcceptedDemoPassword) {
    authenticated = true;
  } else if (password && user.password_hash) {
    authenticated = await verifyPassword(password, user.password_hash);
  }

  if (!authenticated) {
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

  // Set cookie on response for maximum reliability across Next.js runtimes
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
