import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TABS } from "@/lib/catalog";
import { buildCachedDashboardSnapshot } from "@/lib/data/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; expanded?: string }>;
}) {
  const params = await searchParams;
  const snapshot = await buildCachedDashboardSnapshot(params.tab ?? "economic");
  return <DashboardShell initialSnapshot={snapshot} tabs={TABS.map(({ id, label }) => ({ id, label }))} />;
}
