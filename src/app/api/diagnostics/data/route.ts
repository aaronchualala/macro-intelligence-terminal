import { NextRequest, NextResponse } from "next/server";

import { authorizedRefresh } from "@/lib/data/auth";
import { getSupabaseAdmin } from "@/lib/data/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

type TimedOut = { timedOut: true; label: string };

async function timed<T>(label: string, work: PromiseLike<T>, timeoutMs = 8000): Promise<T | TimedOut> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<TimedOut>((resolve) => {
        timeout = setTimeout(() => resolve({ timedOut: true, label }), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function isTimedOut(result: unknown): result is TimedOut {
  return Boolean(result && typeof result === "object" && "timedOut" in result);
}

function countResult(result: unknown) {
  if (!result || typeof result !== "object") return result;
  if (isTimedOut(result)) return result;
  const response = result as { count?: number | null; error?: { message?: string } | null };
  return {
    count: response.count ?? null,
    error: response.error?.message ?? null
  };
}

export async function GET(request: NextRequest) {
  if (!authorizedRefresh(request)) {
    return NextResponse.json({ error: "Unauthorized diagnostics request." }, { status: 401 });
  }

  const env = {
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasFredApiKey: Boolean(process.env.FRED_API_KEY),
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    hasDashboardAdminToken: Boolean(process.env.DASHBOARD_ADMIN_TOKEN)
  };
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({
      ok: false,
      checkedAt: new Date().toISOString(),
      env,
      diagnosis: "Supabase admin client is not configured, so refreshes cannot persist dashboard data."
    });
  }

  const [series, observations, sources, health, recentRuns, recentObservations] = await Promise.all([
    timed("macro_series count", supabase.from("macro_series").select("*", { count: "exact", head: true })),
    timed("macro_observations count", supabase.from("macro_observations").select("*", { count: "exact", head: true })),
    timed("data_sources count", supabase.from("data_sources").select("*", { count: "exact", head: true })),
    timed("source_health count", supabase.from("source_health").select("*", { count: "exact", head: true })),
    timed(
      "recent refresh runs",
      supabase
        .from("refresh_runs")
        .select("scope,status,started_at,finished_at,refreshed_series,refreshed_news,errors")
        .order("started_at", { ascending: false })
        .limit(8)
    ),
    timed(
      "recent observations",
      supabase
        .from("macro_observations")
        .select("series_id,observation_date,source_retrieved_at")
        .order("source_retrieved_at", { ascending: false })
        .limit(12)
    )
  ]);

  const recentRunsData = isTimedOut(recentRuns)
    ? recentRuns
    : (recentRuns as { data?: unknown[]; error?: { message?: string } | null });
  const recentObservationsData = isTimedOut(recentObservations)
    ? recentObservations
    : (recentObservations as { data?: unknown[]; error?: { message?: string } | null });

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    env,
    counts: {
      dataSources: countResult(sources),
      macroSeries: countResult(series),
      macroObservations: countResult(observations),
      sourceHealth: countResult(health)
    },
    recentRefreshRuns:
      isTimedOut(recentRunsData)
        ? recentRunsData
        : { data: recentRunsData.data ?? [], error: recentRunsData.error?.message ?? null },
    recentObservations:
      isTimedOut(recentObservationsData)
        ? recentObservationsData
        : { data: recentObservationsData.data ?? [], error: recentObservationsData.error?.message ?? null }
  });
}
