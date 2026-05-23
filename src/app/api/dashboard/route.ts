import { NextRequest, NextResponse } from "next/server";

import { buildCachedDashboardSnapshot, buildDashboardSnapshot } from "@/lib/data/engine";
import type { DashboardSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cacheLooksTruncated(snapshot: DashboardSnapshot) {
  const cutoff = Date.UTC(1995, 0, 1);
  return snapshot.topMetrics.some((metric) => {
    const latestDate = metric.stats.latestDate;
    if (!latestDate) return false;
    const timestamp = new Date(latestDate).getTime();
    return Number.isFinite(timestamp) && timestamp < cutoff;
  });
}

export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get("tab");
  const cachedSnapshot = await buildCachedDashboardSnapshot(tab);
  const snapshot = cacheLooksTruncated(cachedSnapshot)
    ? await buildDashboardSnapshot(tab, { force: false })
    : cachedSnapshot;

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
