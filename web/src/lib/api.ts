import type {
  AgentRecord,
  BrowserSession,
  ChatBundle,
  ChatMessage,
  ChatThreadRecord,
  InstallTask,
  NipuxSettings,
  NipuxSummary,
  RunRecord,
  RuntimePlan,
  RuntimeStateSummary,
  SettingsUpdate,
  TaskNode,
  ThreadBundle,
  ThreadMessage,
  ThreadRecord,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_NIPUXD_URL?.replace(/\/$/, "") ?? "/api/nipux";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `nipuxd returned ${response.status}`);
  }
  return (await response.json()) as T;
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function openEventStream(path: string): EventSource {
  return new EventSource(apiUrl(path));
}

export function getSummary(): Promise<NipuxSummary> {
  return fetchJson("/api/summary");
}

export function getRuntimePlan(): Promise<RuntimePlan> {
  return fetchJson("/api/runtime/plan");
}

export function startRuntime(payload?: { runtime_id?: string; model_id?: string }): Promise<RuntimeStateSummary> {
  return fetchJson("/api/runtime/start", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function stopRuntime(): Promise<RuntimeStateSummary> {
  return fetchJson("/api/runtime/stop", { method: "POST" });
}

export function getRuntimeStatus(): Promise<RuntimeStateSummary> {
  return fetchJson("/api/runtime/status");
}

export function installRuntime(payload?: { runtime_id?: string; model_id?: string }): Promise<InstallTask> {
  return fetchJson("/api/runtime/install", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function getInstallTask(taskId: string): Promise<InstallTask> {
  return fetchJson(`/api/runtime/install/${taskId}`);
}

export function getSettings(): Promise<NipuxSettings> {
  return fetchJson("/api/settings");
}

export function saveSettings(payload: SettingsUpdate): Promise<NipuxSettings> {
  return fetchJson("/api/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getAgents(): Promise<AgentRecord[]> {
  return fetchJson("/api/agents");
}

export function createAgent(payload: Partial<AgentRecord>): Promise<AgentRecord> {
  return fetchJson("/api/agents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAgent(agentId: string, payload: Partial<AgentRecord>): Promise<AgentRecord> {
  return fetchJson(`/api/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAgent(agentId: string): Promise<{ ok: boolean }> {
  return fetchJson(`/api/agents/${agentId}`, { method: "DELETE" });
}

export function startAgent(agentId: string): Promise<AgentRecord> {
  return fetchJson(`/api/agents/${agentId}/start`, { method: "POST" });
}

export function stopAgent(agentId: string): Promise<AgentRecord> {
  return fetchJson(`/api/agents/${agentId}/stop`, { method: "POST" });
}

export function getAgentBrowser(agentId: string): Promise<BrowserSession> {
  return fetchJson(`/api/agents/${agentId}/browser`);
}

export function sendBrowserCommand(
  sessionId: string,
  payload: { action: string; [key: string]: unknown },
): Promise<BrowserSession> {
  return fetchJson(`/api/browser/${sessionId}/input`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getThreads(agentId?: string): Promise<ThreadRecord[]> {
  const suffix = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
  return fetchJson(`/api/threads${suffix}`);
}

export function createThread(payload: { agent_id: string; title?: string }): Promise<ThreadRecord> {
  return fetchJson("/api/threads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getThreadBundle(threadId: string): Promise<ThreadBundle> {
  return fetchJson(`/api/threads/${threadId}`);
}

export function sendThreadMessage(threadId: string, body: string): Promise<ThreadMessage> {
  return fetchJson(`/api/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function getChatThreads(): Promise<ChatThreadRecord[]> {
  return fetchJson("/api/chat/threads");
}

export function createChatThread(payload?: { title?: string }): Promise<ChatThreadRecord> {
  return fetchJson("/api/chat/threads", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function getChatBundle(threadId: string): Promise<ChatBundle> {
  return fetchJson(`/api/chat/threads/${threadId}`);
}

export function sendChatMessage(threadId: string, body: string): Promise<ChatMessage> {
  return fetchJson(`/api/chat/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function getRuns(): Promise<RunRecord[]> {
  return fetchJson("/api/runs");
}

export function getRun(runId: string): Promise<RunRecord & { tasks: TaskNode[] }> {
  return fetchJson(`/api/runs/${runId}`);
}

export function pauseRun(runId: string): Promise<RunRecord> {
  return fetchJson(`/api/runs/${runId}/pause`, { method: "POST" });
}

export function resumeRun(runId: string): Promise<RunRecord> {
  return fetchJson(`/api/runs/${runId}/resume`, { method: "POST" });
}

export function cancelRun(runId: string): Promise<RunRecord> {
  return fetchJson(`/api/runs/${runId}/cancel`, { method: "POST" });
}
