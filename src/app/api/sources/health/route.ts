import { NextResponse } from "next/server";

import { checkAllSources } from "@/lib/data/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkAllSources();
  return NextResponse.json({ checkedAt: new Date().toISOString(), health });
}
