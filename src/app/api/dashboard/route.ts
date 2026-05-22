import { NextRequest, NextResponse } from "next/server";

import { buildCachedDashboardSnapshot } from "@/lib/data/engine";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get("tab");
  const snapshot = await buildCachedDashboardSnapshot(tab);
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "s-maxage=120, stale-while-revalidate=1800"
    }
  });
}
