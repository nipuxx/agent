"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./app-shell";
import { ChatMessageBubble } from "./chat-message-bubble";
import {
  cancelRun,
  createAgent,
  createThread,
  deleteAgent,
  deleteThread,
  getThreads,
  pauseRun,
  resumeRun,
  sendThreadMessage,
  startAgent,
  stopAgent,
  updateAgent,
} from "@/lib/api";
import { useThreadBundle } from "@/lib/use-thread-bundle";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PendingMessage = { id: string; label: string; body: string; role: string };
type AgentEditorMode = "create" | "edit";
type AgentDraft = { name: string; description: string; system_prompt: string };

const DEFAULT_AGENT_PROMPT = "Work deliberately, verify progress, and checkpoint before claiming success.";

function panelLabel(label: string) {
  return (
    <div className="nipux-label">
      {label}
    </div>
  );
}

export function AgentsView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [editorMode, setEditorMode] = useState<AgentEditorMode | null>(null);
  const [agentDraft, setAgentDraft] = useState<AgentDraft>({
    name: "New Agent",
    description: "Custom long-running Nipux worker.",
    system_prompt: DEFAULT_AGENT_PROMPT,
  });

  const agents = useMemo(() => summary?.agents ?? [], [summary?.agents]);
  const runs = useMemo(() => summary?.runs ?? [], [summary?.runs]);

  useEffect(() => {
    if (!selectedId && agents[0]) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null,
    [agents, selectedId],
  );

  const selectedRun = useMemo(
    () =>
      runs.find(
        (run) => run.agent_id === selectedAgent?.id && ["queued", "planning", "running", "paused"].includes(run.status),
      ) ?? null,
    [runs, selectedAgent?.id],
  );

  const { bundle, refresh: refreshThreadBundle } = useThreadBundle(selectedThreadId);
  const persistedMessageIds = useMemo(
    () => new Set((bundle?.messages ?? []).map((item) => item.id)),
    [bundle?.messages],
  );
  const persistedMessageIdKey = useMemo(
    () => (bundle?.messages ?? []).map((item) => item.id).join("|"),
    [bundle?.messages],
  );
  const visiblePendingMessages = useMemo(
    () => pendingMessages.filter((item) => !persistedMessageIds.has(item.id)),
    [pendingMessages, persistedMessageIds],
  );

  useEffect(() => {
    if (!persistedMessageIdKey) return;
    const ids = new Set(persistedMessageIdKey.split("|"));
    setPendingMessages((current) => current.filter((item) => !ids.has(item.id)));
  }, [persistedMessageIdKey]);

  async function loadThreads(agentId: string) {
    const rows = await getThreads(agentId);
    setThreads(rows);
    setSelectedThreadId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
    return rows;
  }

  useEffect(() => {
    if (!selectedAgent?.id) {
      setThreads([]);
      setSelectedThreadId(null);
      return;
    }
    let active = true;
    loadThreads(selectedAgent.id).catch((err) => {
      if (!active) return;
      setActionError(err instanceof Error ? err.message : "Failed to load agent chats.");
    });
    return () => {
      active = false;
    };
  }, [selectedAgent?.id]);

  function openCreateEditor() {
    setAgentDraft({
      name: "New Agent",
      description: "Custom long-running Nipux worker.",
      system_prompt: DEFAULT_AGENT_PROMPT,
    });
    setEditorMode("create");
  }

  function openEditEditor() {
    if (!selectedAgent) return;
    setAgentDraft({
      name: selectedAgent.name,
      description: selectedAgent.description,
      system_prompt: selectedAgent.system_prompt || DEFAULT_AGENT_PROMPT,
    });
    setEditorMode("edit");
  }

  async function handleSaveAgent() {
    setPending(true);
    setActionError(null);
    try {
      const payload = {
        name: agentDraft.name.trim() || "New Agent",
        description: agentDraft.description.trim(),
        system_prompt: agentDraft.system_prompt.trim() || DEFAULT_AGENT_PROMPT,
      };
      if (editorMode === "edit" && selectedAgent) {
        const updated = await updateAgent(selectedAgent.id, payload);
        setSelectedId(updated.id);
      } else {
        const created = await createAgent(payload);
        setSelectedId(created.id);
      }
      setEditorMode(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save agent.");
    } finally {
      setPending(false);
    }
  }

  async function handleToggle() {
    if (!selectedAgent) return;
    setPending(true);
    setActionError(null);
    try {
      if (selectedAgent.status === "running") {
        await stopAgent(selectedAgent.id);
      } else {
        await startAgent(selectedAgent.id);
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to change agent state.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!selectedAgent) return;
    setPending(true);
    setActionError(null);
    try {
      await deleteAgent(selectedAgent.id);
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete agent.");
    } finally {
      setPending(false);
    }
  }

  async function handleNewThread() {
    if (!selectedAgent) return;
    setPending(true);
    setActionError(null);
    try {
      const thread = await createThread({ agent_id: selectedAgent.id });
      setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
      setSelectedThreadId(thread.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create agent chat.");
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteThread() {
    if (!selectedAgent || !selectedThreadId) return;
    setPending(true);
    setActionError(null);
    try {
      await deleteThread(selectedThreadId);
      setPendingMessages([]);
      await Promise.all([loadThreads(selectedAgent.id), refresh()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete agent chat.");
    } finally {
      setPending(false);
    }
  }

  async function handleRunAction(action: "pause" | "resume" | "cancel") {
    if (!selectedRun) return;
    setPending(true);
    setActionError(null);
    try {
      if (action === "pause") {
        await pauseRun(selectedRun.id);
      } else if (action === "resume") {
        await resumeRun(selectedRun.id);
      } else {
        await cancelRun(selectedRun.id);
      }
      await Promise.all([refresh(), refreshThreadBundle()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update run.");
    } finally {
      setPending(false);
    }
  }

  async function handleSendAgentMessage() {
    if (!selectedAgent || !agentMessage.trim()) return;
    setPending(true);
    setActionError(null);
    const body = agentMessage.trim();
    const optimisticUserId = `pending-user-${Date.now()}`;
    setAgentMessage("");
    try {
      let threadId = selectedThreadId;
      if (!threadId) {
        const thread = await createThread({ agent_id: selectedAgent.id });
        threadId = thread.id;
        setSelectedThreadId(thread.id);
        setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
      }
      setPendingMessages([
        {
          id: optimisticUserId,
          label: "user",
          body,
          role: "user",
        },
      ]);
      const sent = await sendThreadMessage(threadId, body);
      setPendingMessages((current) => [
        ...current.filter((item) => item.id !== optimisticUserId && item.id !== sent.id),
        {
          id: sent.id,
          label: sent.label,
          body: sent.body,
          role: sent.role,
        },
      ]);
      await Promise.all([loadThreads(selectedAgent.id), refresh(), refreshThreadBundle()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send agent message.");
      setAgentMessage(body);
      setPendingMessages([]);
    } finally {
      setPending(false);
    }
  }

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center nipux-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Loading agents...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center px-6 text-[15px] text-[var(--muted-foreground)]">
          {error ?? "Agents are unavailable."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="nipux-agents-layout grid h-full min-h-0 min-w-0 overflow-hidden">
        <aside className="min-h-0 border-r border-[var(--border)]">
          <div className="border-b border-[var(--border)] p-[var(--page-padding)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                {panelLabel("agents")}
                <div className="nipux-title mt-3 text-[24px] text-[var(--foreground)]">Workers</div>
              </div>
              <Button size="sm" onClick={openCreateEditor} disabled={pending}>
                New
              </Button>
            </div>
          </div>

          <div className="min-h-0 overflow-auto px-3 py-3">
            {agents.length ? (
              agents.map((agent) => {
                const active = agent.id === selectedAgent?.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedId(agent.id)}
                    className={`w-full border-b border-[var(--border)] px-3 py-4 text-left transition-colors ${
                      active ? "bg-[var(--active-surface)]" : "hover:bg-[var(--hover-surface)]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="nipux-title truncate text-[18px] text-[var(--foreground)]">
                        {agent.name}
                      </div>
                      {agent.description ? (
                        <div className="mt-2 line-clamp-2 text-[13px] leading-[1.6] text-[var(--muted-foreground)]">
                          {agent.description}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-[14px] leading-[1.7] text-[var(--muted-foreground)]">
                No agents yet. Create one here, then start chatting with it.
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] p-[var(--page-padding)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                {panelLabel("selected agent")}
                <h1 className="nipux-title mt-3 text-[34px] text-[var(--foreground)]">
                  {selectedAgent?.name ?? "No agent"}
                </h1>
                <p className="mt-3 max-w-[760px] text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  {selectedRun?.goal || "Start the agent, then chat with it directly."}
                </p>
              </div>
              {selectedAgent ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void handleDelete()} disabled={pending}>
                    Delete
                  </Button>
                  <Button variant="outline" size="sm" onClick={openEditEditor} disabled={pending}>
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => void handleToggle()} disabled={pending}>
                    {selectedAgent.status === "running" ? "Stop" : "Start"}
                  </Button>
                </div>
              ) : null}
            </div>
            {selectedRun ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                <span className="nipux-mono uppercase tracking-[var(--label-letter-spacing)]">
                  Run: {selectedRun.status}
                </span>
                {selectedRun.status === "paused" ? (
                  <Button variant="outline" size="sm" onClick={() => void handleRunAction("resume")} disabled={pending}>
                    Resume
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => void handleRunAction("pause")} disabled={pending}>
                    Pause
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => void handleRunAction("cancel")} disabled={pending}>
                  Cancel run
                </Button>
              </div>
            ) : null}
            {actionError ? <p className="mt-4 text-[14px] text-[var(--danger)]">{actionError}</p> : null}
          </header>

          <div className="min-h-0 flex-1 p-[var(--page-padding)]">
            <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]">
              <div className="nipux-panel min-h-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  {panelLabel("threads")}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void handleDeleteThread()} disabled={!selectedThreadId || pending}>
                      Delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleNewThread()} disabled={!selectedAgent || pending}>
                      New
                    </Button>
                  </div>
                </div>
                <div className="max-h-full overflow-auto">
                  {threads.length ? (
                    threads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setSelectedThreadId(thread.id)}
                        className={`w-full border-b border-[var(--border)] px-3 py-3 text-left transition-colors ${
                          thread.id === selectedThreadId ? "bg-[var(--active-surface)]" : "hover:bg-[var(--hover-surface)]"
                        }`}
                      >
                        <div className="truncate text-[14px] text-[var(--foreground)]">{thread.title}</div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                      No threads yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="nipux-panel grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
                <div className="overflow-auto p-[var(--panel-padding)]">
                  <div className="nipux-message-list">
                    {bundle?.messages.length || visiblePendingMessages.length ? (
                      <>
                        {(bundle?.messages ?? []).map((message) => (
                          <ChatMessageBubble
                            key={message.id}
                            label={message.label}
                            body={message.body}
                            role={message.role}
                          />
                        ))}
                        {visiblePendingMessages.map((message) => (
                          <ChatMessageBubble
                            key={message.id}
                            label={message.label}
                            body={message.body}
                            role={message.role}
                          />
                        ))}
                      </>
                    ) : (
                      <div className="text-[13px] leading-[1.8] text-[var(--muted-foreground)]">
                        Start the agent, then send it work here.
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-[var(--border)] p-[var(--panel-padding)]">
                  <div className="grid gap-3">
                    <Input
                      value={agentMessage}
                      onChange={(event) => setAgentMessage(event.target.value)}
                      placeholder="Tell this agent what to do..."
                      disabled={!selectedAgent || pending}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendAgentMessage();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] leading-[1.7] text-[var(--muted-foreground)]">
                        Current work: {selectedRun?.goal || "idle"}
                      </div>
                      <Button size="sm" onClick={() => void handleSendAgentMessage()} disabled={!selectedAgent || pending || !agentMessage.trim()}>
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

      </section>
      {editorMode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/58 px-4 py-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Agent editor">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close agent editor"
            onClick={() => setEditorMode(null)}
          />
          <div className="relative grid h-[min(620px,90dvh)] w-[min(720px,94vw)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[var(--radius-frame)] border border-[var(--border)] bg-[var(--background)] shadow-[var(--panel-shadow)]">
            <header className="border-b border-[var(--border)] px-5 py-4">
              {panelLabel(editorMode === "edit" ? "edit agent" : "new agent")}
              <div className="nipux-title mt-2 text-[26px] text-[var(--foreground)]">
                {editorMode === "edit" ? "Agent definition" : "Create worker"}
              </div>
            </header>
            <main className="min-h-0 overflow-auto p-5">
              <div className="grid gap-4">
                <Input
                  value={agentDraft.name}
                  onChange={(event) => setAgentDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Agent name"
                />
                <Textarea
                  value={agentDraft.description}
                  onChange={(event) => setAgentDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Short description"
                  className="min-h-[86px]"
                />
                <Textarea
                  value={agentDraft.system_prompt}
                  onChange={(event) => setAgentDraft((current) => ({ ...current, system_prompt: event.target.value }))}
                  placeholder="System prompt"
                  className="min-h-[220px]"
                />
              </div>
            </main>
            <footer className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setEditorMode(null)} disabled={pending}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSaveAgent()} disabled={pending}>
                Save
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
