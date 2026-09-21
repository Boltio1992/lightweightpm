import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import type { UserPublic } from "@/types";

// Use at the top of any API route that requires auth:
//   const auth = await requireUser();
//   if (auth instanceof NextResponse) return auth;
//   const user = auth;
export async function requireUser(): Promise<UserPublic | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return user;
}
