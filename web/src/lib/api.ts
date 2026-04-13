import { mockSettings, mockSummary } from "./mock-summary";
import type { HermesSettingsSummary, HermesSettingsUpdate, NipuxSummary } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_NIPUXD_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:9384";

async function fetchJson<T>(path: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`nipuxd returned ${response.status}`);
    }
    return (await response.json()) as T;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error("Failed to reach nipuxd");
  }
}

export function getSummary(): Promise<NipuxSummary> {
  return fetchJson("/api/summary", undefined, mockSummary);
}

export function getHermesSettings(): Promise<HermesSettingsSummary> {
  return fetchJson("/api/hermes/settings", undefined, mockSettings);
}

export function saveHermesSettings(payload: HermesSettingsUpdate): Promise<HermesSettingsSummary> {
  return fetchJson(
    "/api/hermes/settings",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    {
      ...mockSettings,
      ...payload,
      toolsets:
        typeof payload.toolsets === "string"
          ? payload.toolsets.split(",").map((item) => item.trim()).filter(Boolean)
          : payload.toolsets ?? mockSettings.toolsets,
      openrouter_api_key_set:
        typeof payload.openrouter_api_key === "string" && payload.openrouter_api_key.length > 0
          ? true
          : mockSettings.openrouter_api_key_set,
      openai_api_key_set:
        typeof payload.openai_api_key === "string" && payload.openai_api_key.length > 0
          ? true
          : mockSettings.openai_api_key_set,
    },
  );
}

function postSummary(path: string): Promise<NipuxSummary> {
  return fetchJson(
    path,
    {
      method: "POST",
    },
    mockSummary,
  );
}

export function loadModel(): Promise<NipuxSummary> {
  return postSummary("/api/runtime/load");
}

export function unloadModel(): Promise<NipuxSummary> {
  return postSummary("/api/runtime/unload");
}

export function startNode(nodeId: string): Promise<NipuxSummary> {
  return postSummary(`/api/agents/${nodeId}/start`);
}

export function stopNode(nodeId: string): Promise<NipuxSummary> {
  return postSummary(`/api/agents/${nodeId}/stop`);
}
