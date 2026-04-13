import { DashboardView } from "@/components/dashboard-view";
import { mockSummary } from "@/lib/mock-summary";
import type { NipuxSummary } from "@/lib/types";

async function getInitialSummary(): Promise<NipuxSummary> {
  const apiBase = process.env.NIPUXD_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:9384";
  try {
    const response = await fetch(`${apiBase}/api/summary`, { cache: "no-store" });
    if (!response.ok) throw new Error(`nipuxd returned ${response.status}`);
    return (await response.json()) as NipuxSummary;
  } catch {
    return mockSummary;
  }
}

export default async function DashboardPage() {
  const initialSummary = await getInitialSummary();
  return <DashboardView initialSummary={initialSummary} />;
}
