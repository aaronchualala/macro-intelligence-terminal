import { NextRequest, NextResponse } from "next/server";

import { TABS } from "@/lib/catalog";
import { authorizedRefresh } from "@/lib/data/auth";
import { refreshTabData } from "@/lib/data/engine";
import { getSupabaseAdmin } from "@/lib/data/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ tab: string }>;
};

async function runTabEtl(request: NextRequest, context: RouteContext) {
  if (!authorizedRefresh(request)) {
    return NextResponse.json({ error: "Unauthorized ETL request." }, { status: 401 });
  }
  const params = await Promise.resolve(context.params);
  const tab = TABS.find((item) => item.id === params.tab);
  if (!tab) {
    return NextResponse.json({ error: `Unknown tab: ${params.tab}` }, { status: 404 });
  }

  const scope = request.nextUrl.searchParams.get("scope") === "all" ? "all" : "critical";
  const supabase = getSupabaseAdmin();
  const runInsert = supabase
    ? await supabase
        .from("refresh_runs")
        .insert({ scope: `${scope}:${tab.id}`, status: "running" })
        .select("id")
        .single()
    : { data: null };
  const runId = runInsert.data?.id;

  try {
    const result = await refreshTabData(tab.id, scope);
    if (supabase && runId) {
      await supabase
        .from("refresh_runs")
        .update({
          status: result.errors.length ? "completed_with_errors" : "completed",
          finished_at: new Date().toISOString(),
          refreshed_series: result.refreshedSeries,
          refreshed_news: result.refreshedNews,
          errors: result.errors
        })
        .eq("id", runId);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (supabase && runId) {
      await supabase
        .from("refresh_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          errors: [message]
        })
        .eq("id", runId);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return runTabEtl(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return runTabEtl(request, context);
}
