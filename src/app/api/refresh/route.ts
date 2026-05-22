import { NextRequest, NextResponse } from "next/server";

import { TABS } from "@/lib/catalog";
import { authorizedRefresh } from "@/lib/data/auth";
import { refreshTabDataBatch } from "@/lib/data/batch-refresh";
import { getSupabaseAdmin } from "@/lib/data/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runRefresh(request: NextRequest) {
  if (!authorizedRefresh(request)) {
    return NextResponse.json({ error: "Unauthorized refresh request." }, { status: 401 });
  }
  const scope = request.nextUrl.searchParams.get("scope") ?? "critical";
  const tab = request.nextUrl.searchParams.get("tab");
  const panels = request.nextUrl.searchParams
    .getAll("panel")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "");
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "");
  const includeNews = ["1", "true", "yes"].includes((request.nextUrl.searchParams.get("news") ?? "").toLowerCase());
  const supabase = getSupabaseAdmin();
  const runInsert = supabase
    ? await supabase
        .from("refresh_runs")
        .insert({ scope, status: "running" })
        .select("id")
        .single()
    : { data: null };
  const runId = runInsert.data?.id;
  const errors: string[] = [];
  let refreshedSeries = 0;
  let refreshedNews = 0;

  try {
    const tabs = tab ? [tab] : TABS.map((item) => item.id);
    for (const tabId of tabs) {
      const result = await refreshTabDataBatch(tabId, scope === "all" ? "all" : "critical", {
        panelIds: panels,
        limitSeries: Number.isFinite(limit) && limit > 0 ? limit : undefined,
        offset: Number.isFinite(offset) && offset > 0 ? offset : undefined,
        includeNews
      });
      refreshedSeries += result.refreshedSeries;
      refreshedNews += result.refreshedNews;
      errors.push(...result.errors);
    }

    if (supabase && runId) {
      await supabase
        .from("refresh_runs")
        .update({
          status: errors.length ? "completed_with_errors" : "completed",
          finished_at: new Date().toISOString(),
          refreshed_series: refreshedSeries,
          refreshed_news: refreshedNews,
          errors
        })
        .eq("id", runId);
    }

    return NextResponse.json({
      ok: true,
      scope,
      refreshedSeries,
      refreshedNews,
      errors
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (supabase && runId) {
      await supabase
        .from("refresh_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          refreshed_series: refreshedSeries,
          refreshed_news: refreshedNews,
          errors: [...errors, message]
        })
        .eq("id", runId);
    }
    return NextResponse.json({ ok: false, error: message, errors }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return runRefresh(request);
}

export async function POST(request: NextRequest) {
  return runRefresh(request);
}
