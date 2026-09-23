import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseServer";
import type { UserPublic } from "@/types";

const COOKIE_NAME = "lightpm_session";
const SESSION_DAYS = 30;

const DEFAULT_SESSION_SECRET = "lightpm-dev-session-secret-key-32-chars-long";

function getSecret() {
  const secret = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function readSessionUserId(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

// Reads the session cookie (server components / route handlers) and returns
// the current user's public profile, or null if not logged in.
export async function getCurrentUser(): Promise<UserPublic | null> {
  const store = cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const userId = await readSessionUserId(token);
  if (!userId) return null;

  const { data, error } = await supabaseAdmin()
    .from("users")
    .select("id, username, name, title, role, created_at")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as UserPublic;
}
