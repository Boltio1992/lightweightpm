import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Project data import is no longer supported." },
    { status: 410 }
  );
}
