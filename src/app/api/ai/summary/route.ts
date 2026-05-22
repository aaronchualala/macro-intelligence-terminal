import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { buildCachedDashboardSnapshot } from "@/lib/data/engine";
import { hashString } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { tab?: string; panelId?: string };
  const snapshot = await buildCachedDashboardSnapshot(body.tab ?? "economic");
  const panel = snapshot.panels.find((item) => item.id === body.panelId) ?? snapshot.panels[0];
  if (!panel) return NextResponse.json({ error: "Panel not found." }, { status: 404 });

  const evidence = {
    panel: panel.title,
    regime: panel.regime,
    conclusion: panel.conclusion,
    metrics: panel.metrics.slice(0, 8).map((metric) => ({
      label: metric.config.label,
      latest: metric.stats.latest,
      latestDate: metric.stats.latestDate,
      yoy: metric.stats.yoy,
      mom: metric.stats.mom,
      percentile: metric.stats.percentile,
      source: metric.citation.humanUrl
    })),
    news: panel.news.slice(0, 5).map((item) => ({
      title: item.title,
      publishedAt: item.publishedAt,
      url: item.url
    })),
    scenarios: panel.scenarios
  };

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      mode: "deterministic",
      model: "none",
      summary: `${panel.title}: ${panel.regime}. ${panel.conclusion} Main watch items: ${panel.catalysts.slice(0, 3).join(", ") || "latest data releases and source flow"}.`,
      citations: panel.citations.slice(0, 8)
    });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-5.2";
  const prompt = JSON.stringify(evidence);
  const response = await client.responses.create({
    model,
    instructions:
      "You are writing for a serious macro investor. Use only the supplied evidence. Be concise, quantify where possible, include what changed, what matters next, and underpriced risks. Do not invent data.",
    input: prompt,
    max_output_tokens: 600
  });

  return NextResponse.json({
    mode: "ai",
    model,
    promptHash: hashString(prompt),
    summary: response.output_text,
    citations: panel.citations.slice(0, 10)
  });
}
