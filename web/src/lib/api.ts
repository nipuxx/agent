import { mockSummary } from "./mock-summary";
import type { NipuxSummary } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_NIPUXD_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:9384";

export async function getSummary(): Promise<NipuxSummary> {
  try {
    const response = await fetch(`${API_BASE}/api/summary`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`nipuxd returned ${response.status}`);
    }
    return (await response.json()) as NipuxSummary;
  } catch {
    return mockSummary;
  }
}

