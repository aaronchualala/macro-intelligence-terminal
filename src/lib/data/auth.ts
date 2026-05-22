import type { NextRequest } from "next/server";

export function authorizedRefresh(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const adminToken = process.env.DASHBOARD_ADMIN_TOKEN;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const querySecret = request.nextUrl.searchParams.get("secret");
  if (!cronSecret && !adminToken) return process.env.NODE_ENV !== "production";
  return Boolean(
    (cronSecret && (bearer === cronSecret || querySecret === cronSecret)) ||
      (adminToken && (bearer === adminToken || querySecret === adminToken))
  );
}
