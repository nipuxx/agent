"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./app-shell";
import { BrowserPane } from "./browser-pane";
import {
  createAgent,
  createThread,
  deleteAgent,
  getThreads,
  sendThreadMessage,
  startAgent,
  stopAgent,
  updateAgent,
} from "@/lib/api";
import { useLiveSummary } from "@/lib/use-live-summary";
import { useThreadBundle } from "@/lib/use-thread-bundle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_PROMPT =
  "Work deliberately, verify progress, and keep going until the task is actually resolved.";
const DEFAULT_TOOLS = ["browser", "terminal", "file", "clarify"];

function panelLabel(label: string) {
  return (
    <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
      {label}
    </div>
  );
}

function statusVariant(status: string) {
  return status === "running" ? "success" : "secondary";
}

export function WorkspaceView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftAgentId, setDraftAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentTools, setAgentTools] = useState(DEFAULT_TOOLS.join(", "));

  const agents = useMemo(() => summary?.agents ?? [], [summary?.agents]);
  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ??
    (selectedAgentId ? null : agents[0] ?? null);
  const activeRun =
    summary?.runs.find(
      (run) =>
        run.agent_id === selectedAgent?.id &&
        ["queued", "planning", "running", "paused"].includes(run.status),
    ) ?? null;
  const { bundle } = useThreadBundle(selectedThreadId);

  useEffect(() => {
    if (selectedAgentId && agents.some((agent) => agent.id === selectedAgentId)) {
      return;
    }
    setSelectedAgentId(agents[0]?.id ?? null);
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgent) {
      setDraftAgentId(null);
      setAgentName("");
      setAgentPrompt("");
      setAgentTools(DEFAULT_TOOLS.join(", "));
      return;
    }
    if (draftAgentId === selectedAgent.id) {
      return;
    }
    setDraftAgentId(selectedAgent.id);
    setAgentName(selectedAgent.name);
    setAgentPrompt(selectedAgent.system_prompt);
    setAgentTools(selectedAgent.toolsets.join(", "));
  }, [draftAgentId, selectedAgent]);

  useEffect(() => {
    if (!selectedAgent?.id) {
      setSelectedThreadId(null);
      return;
    }
    let active = true;
    setThreadLoading(true);
    void getThreads(selectedAgent.id)
      .then((rows) => {
        if (!active) {
          return;
        }
        setSelectedThreadId((current) => {
          if (current && rows.some((row) => row.id === current)) {
            return current;
          }
          return rows[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setActionError(err instanceof Error ? err.message : "Failed to load agent threads.");
      })
      .finally(() => {
        if (active) {
          setThreadLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedAgent?.id]);

  async function withPending<T>(key: string, task: () => Promise<T>) {
    setPendingAction(key);
    setActionError(null);
    try {
      return await task();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
      throw err;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateAgent() {
    const created = await withPending("create-agent", async () => {
      const agent = await createAgent({
        name: "Untitled agent",
        description: "",
        system_prompt: DEFAULT_PROMPT,
        toolsets: DEFAULT_TOOLS,
      });
      const thread = await createThread({
        agent_id: agent.id,
        title: `${agent.name} thread`,
      });
      setSelectedThreadId(thread.id);
      return agent;
    });
    setSelectedAgentId(created.id);
    await refresh();
  }

  async function handleDeleteAgent() {
    if (!selectedAgent) {
      return;
    }
    await withPending("delete-agent", async () => {
      await deleteAgent(selectedAgent.id);
      setSelectedAgentId(null);
      setSelectedThreadId(null);
    });
    await refresh();
  }

  async function handleSaveAgent() {
    if (!selectedAgent) {
      return;
    }
    await withPending("save-agent", async () => {
      await updateAgent(selectedAgent.id, {
        name: agentName.trim() || "Untitled agent",
        system_prompt: agentPrompt.trim() || DEFAULT_PROMPT,
        toolsets: agentTools
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
    });
    await refresh();
  }

  async function handleToggleAgent() {
    if (!selectedAgent) {
      return;
    }
    await withPending("toggle-agent", async () => {
      if (selectedAgent.status === "running") {
        await stopAgent(selectedAgent.id);
      } else {
        await startAgent(selectedAgent.id);
      }
    });
    await refresh();
  }

  async function handleSendMessage() {
    if (!selectedAgent || !message.trim()) {
      return;
    }
    const body = message.trim();
    setMessage("");
    try {
      await withPending("send-message", async () => {
        let threadId = selectedThreadId;
        if (!threadId) {
          const thread = await createThread({
            agent_id: selectedAgent.id,
            title: `${selectedAgent.name} thread`,
          });
          threadId = thread.id;
          setSelectedThreadId(thread.id);
        }
        await sendThreadMessage(threadId, body);
      });
      await refresh();
    } catch {
      setMessage(body);
    }
  }

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          Loading agents...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          {error ?? "Agents are unavailable."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="grid h-[calc(100vh-52px)] min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-5 py-5">
            {panelLabel("agents")}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-[22px] font-medium tracking-[-0.05em] text-[var(--foreground)]">
                Local agents
              </div>
              <Button
                size="sm"
                onClick={() => void handleCreateAgent()}
                disabled={pendingAction === "create-agent"}
              >
                New
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {agents.length ? (
              agents.map((agent) => {
                const active = agent.id === selectedAgent?.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`w-full border-b border-[var(--border)] px-5 py-4 text-left transition-colors ${
                      active ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[16px] font-medium tracking-[-0.04em] text-[var(--foreground)]">
                          {agent.name}
                        </div>
                        <div className="mt-2 nipux-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                          {agent.status}
                        </div>
                      </div>
                      <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-5 py-6 text-[14px] leading-[1.7] text-[var(--muted-foreground)]">
                No agents yet. Create one here, then talk to it in the main pane.
              </div>
            )}
          </div>
        </aside>

        <main className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                {panelLabel("agents")}
                <div className="mt-3 text-[26px] font-medium tracking-[-0.05em] text-[var(--foreground)]">
                  {selectedAgent?.name ?? "Create an agent"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedAgent ? (
                  <>
                    <Badge variant={statusVariant(selectedAgent.status)}>
                      {selectedAgent.status}
                    </Badge>
                    {activeRun ? <Badge variant="secondary">{activeRun.status}</Badge> : null}
                  </>
                ) : null}
              </div>
            </div>
            {actionError ? (
              <p className="mt-4 text-[13px] leading-[1.6] text-[#d8a499]">{actionError}</p>
            ) : null}
          </header>

          <div className="min-h-0 overflow-auto px-5 py-5 md:px-6">
            {selectedAgent ? (
              bundle?.messages?.length ? (
                <div className="space-y-5">
                  {bundle.messages.map((item) => (
                    <div
                      key={item.id}
                      className={
                        item.kind === "tool"
                          ? "border border-[var(--border)] bg-white/[0.02] px-4 py-4"
                          : ""
                      }
                    >
                      <div className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        {item.label}
                      </div>
                      <div
                        className={
                          item.kind === "tool"
                            ? "mt-3 whitespace-pre-wrap nipux-mono text-[12px] leading-[1.8] text-[var(--foreground)]/78"
                            : "mt-3 whitespace-pre-wrap text-[15px] leading-[1.82] text-[var(--foreground)]/92"
                        }
                      >
                        {item.body}
                      </div>
                    </div>
                  ))}
                </div>
              ) : threadLoading ? (
                <div className="text-[14px] text-[var(--muted-foreground)]">
                  Loading conversation…
                </div>
              ) : (
                <div className="text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  This agent has no conversation yet. Send a message below to start.
                </div>
              )
            ) : (
              <div className="text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                Create an agent first. Then select it and assign work here.
              </div>
            )}
          </div>

          <footer className="border-t border-[var(--border)] px-5 py-4 md:px-6">
            <div className="grid gap-2.5">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell the selected agent what to do..."
                disabled={!selectedAgent || pendingAction === "send-message"}
              />
              <div className="flex items-center gap-2">
                {(selectedAgent?.toolsets ?? []).map((tool) => (
                  <Badge key={tool} variant="secondary">
                    {tool}
                  </Badge>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleToggleAgent()}
                    disabled={!selectedAgent || pendingAction === "toggle-agent"}
                  >
                    {selectedAgent?.status === "running" ? "Stop" : "Start"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleSendMessage()}
                    disabled={!selectedAgent || pendingAction === "send-message" || !message.trim()}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </footer>
        </main>

        <aside className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_220px]">
          <div className="min-h-0 overflow-hidden border-b border-[var(--border)]">
            <BrowserPane agentId={selectedAgent?.id} title="browser" />
          </div>

          <section className="min-h-0 overflow-auto px-5 py-4">
            {panelLabel("agent config")}
            {selectedAgent ? (
              <div className="mt-4 grid gap-3">
                <Input
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  placeholder="Agent name"
                />
                <Textarea
                  value={agentPrompt}
                  onChange={(event) => setAgentPrompt(event.target.value)}
                  placeholder="System prompt"
                  className="min-h-[112px]"
                />
                <Input
                  value={agentTools}
                  onChange={(event) => setAgentTools(event.target.value)}
                  placeholder="browser, terminal, file, clarify"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSaveAgent()}
                    disabled={pendingAction === "save-agent"}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDeleteAgent()}
                    disabled={pendingAction === "delete-agent"}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                Select an agent to edit its prompt and tools.
              </div>
            )}
          </section>
        </aside>
      </section>
    </AppShell>
  );
}
