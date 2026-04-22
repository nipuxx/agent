"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./app-shell";
import { BrowserPane } from "./browser-pane";
import { createAgent, createThread, deleteAgent, getThreads, sendThreadMessage, startAgent, stopAgent, updateAgent } from "@/lib/api";
import { useThreadBundle } from "@/lib/use-thread-bundle";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

export function AgentsView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const [browserWidth, setBrowserWidth] = useState(560);

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

  useEffect(() => {
    if (!selectedAgent) return;
    setName(selectedAgent.name);
    setDescription(selectedAgent.description);
    setSystemPrompt(selectedAgent.system_prompt);
  }, [selectedAgent]);

  const selectedRun = useMemo(
    () =>
      runs.find(
        (run) => run.agent_id === selectedAgent?.id && ["queued", "planning", "running", "paused"].includes(run.status),
      ) ?? null,
    [runs, selectedAgent?.id],
  );
  const { bundle } = useThreadBundle(selectedThreadId);

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

  async function handleSave() {
    if (!selectedAgent) return;
    setPending(true);
    setActionError(null);
    try {
      await updateAgent(selectedAgent.id, {
        name,
        description,
        system_prompt: systemPrompt,
      });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save agent.");
    } finally {
      setPending(false);
    }
  }

  async function handleCreate() {
    setPending(true);
    setActionError(null);
    try {
      const created = await createAgent({
        name: "New Agent",
        description: "Custom long-running Nipux worker.",
        system_prompt: "Work deliberately, verify progress, and checkpoint before claiming success.",
      });
      setSelectedId(created.id);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create agent.");
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
      await loadThreads(selectedAgent.id);
      setSelectedThreadId(thread.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create agent chat.");
    } finally {
      setPending(false);
    }
  }

  async function handleSendAgentMessage() {
    if (!selectedAgent || !agentMessage.trim()) return;
    setPending(true);
    setActionError(null);
    const body = agentMessage.trim();
    setAgentMessage("");
    try {
      let threadId = selectedThreadId;
      if (!threadId) {
        const thread = await createThread({ agent_id: selectedAgent.id });
        threadId = thread.id;
        setSelectedThreadId(thread.id);
      }
      await sendThreadMessage(threadId, body);
      await Promise.all([loadThreads(selectedAgent.id), refresh()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send agent message.");
      setAgentMessage(body);
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
      <section
        className="grid h-screen min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:[grid-template-columns:280px_minmax(0,1fr)_var(--browser-width)]"
        style={{ ["--browser-width" as string]: `${browserWidth}px` }}
      >
        <aside className="min-h-0 border-r border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-5 py-5">
            {panelLabel("agents")}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-[24px] font-medium tracking-[-0.05em] text-[var(--foreground)]">Workers</div>
              <Button size="sm" onClick={() => void handleCreate()} disabled={pending}>
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
                      active ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[18px] font-medium tracking-[-0.04em] text-[var(--foreground)]">
                          {agent.name}
                        </div>
                        <div className="mt-2 text-[13px] leading-[1.6] text-[var(--muted-foreground)]">
                          {agent.description || "No summary yet."}
                        </div>
                      </div>
                      <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-[14px] leading-[1.7] text-[var(--muted-foreground)]">
                No agents yet. Create one here, then use Chats to assign work.
              </div>
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-auto border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-6 py-5 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                {panelLabel("selected agent")}
                <h1 className="mt-3 text-[34px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
                  {selectedAgent?.name ?? "No agent"}
                </h1>
              </div>
              {selectedAgent ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void handleSave()} disabled={pending}>
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleDelete()} disabled={pending}>
                    Delete
                  </Button>
                  <Button size="sm" onClick={() => void handleToggle()} disabled={pending}>
                    {selectedAgent.status === "running" ? "Stop" : "Start"}
                  </Button>
                </div>
              ) : null}
            </div>
            {actionError ? <p className="mt-4 text-[14px] text-[#d8a499]">{actionError}</p> : null}
          </header>

          <div className="grid gap-5 px-6 py-5 md:px-8">
            <div className="grid gap-2">
              <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Name
              </label>
              <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!selectedAgent} />
            </div>

            <div className="grid gap-2">
              <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Summary
              </label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={!selectedAgent} className="min-h-[100px]" />
            </div>

            <div className="grid gap-2">
              <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                System prompt
              </label>
              <Textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} disabled={!selectedAgent} className="min-h-[220px]" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-[var(--border)] px-4 py-4">
                {panelLabel("live state")}
                <div className="mt-3 space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  <div>Status: {selectedAgent?.status ?? "idle"}</div>
                  <div>Run: {selectedRun?.status ?? "idle"}</div>
                  <div>Chats: {threads.length}</div>
                </div>
              </div>

              <div className="border border-[var(--border)] px-4 py-4">
                {panelLabel("current work")}
                <div className="mt-3 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  {selectedRun?.goal || selectedAgent?.description || "No active work summary yet."}
                </div>
              </div>
            </div>

            <div className="border border-[var(--border)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                {panelLabel("agent chat")}
                <Button variant="outline" size="sm" onClick={() => void handleNewThread()} disabled={!selectedAgent || pending}>
                  New thread
                </Button>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                <div className="min-h-0 border border-[var(--border)]">
                  <div className="max-h-[360px] overflow-auto">
                    {threads.length ? (
                      threads.map((thread) => (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`w-full border-b border-[var(--border)] px-3 py-3 text-left transition-colors ${
                            thread.id === selectedThreadId ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                          }`}
                        >
                          <div className="truncate text-[14px] text-[var(--foreground)]">{thread.title}</div>
                          <div className="mt-1 nipux-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                            {thread.status}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                        No agent chats yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] border border-[var(--border)]">
                  <div className="max-h-[360px] min-h-[240px] overflow-auto px-4 py-4">
                    <div className="space-y-5">
                      {bundle?.messages.length ? (
                        bundle.messages.map((message) => (
                          <div key={message.id} className={message.role === "assistant" ? "border border-[var(--border)] px-4 py-4" : ""}>
                            <div className="nipux-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                              {message.label}
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.8] text-[var(--foreground)]/88">
                              {message.body}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[13px] leading-[1.8] text-[var(--muted-foreground)]">
                          Select a thread or send a new message to this agent.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-[var(--border)] px-4 py-4">
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
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => void handleSendAgentMessage()} disabled={!selectedAgent || pending || !agentMessage.trim()}>
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-hidden border-l border-[var(--border)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            {panelLabel("browser")}
            <div className="flex items-center gap-3">
              <div className="nipux-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                width
              </div>
              <input
                type="range"
                min={420}
                max={920}
                step={20}
                value={browserWidth}
                onChange={(event) => setBrowserWidth(Number(event.target.value))}
              />
            </div>
          </div>
          <BrowserPane agentId={selectedAgent?.id} title="browser" showControls={false} />
        </aside>
      </section>
    </AppShell>
  );
}
