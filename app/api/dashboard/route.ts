import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { getDashboardData } from "@/lib/dashboard";

export const revalidate = 30;

// Same computation the dashboard page renders on the server. One implementation
// replaces the old FK-hinted join and its slow retry chain.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await getDashboardData());
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unable to load dashboard." }, { status: 500 });
  }
}
