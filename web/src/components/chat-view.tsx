"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./app-shell";
import { BrowserPane } from "./browser-pane";
import { createThread, getRun, getThreads, sendThreadMessage } from "@/lib/api";
import { useLiveSummary } from "@/lib/use-live-summary";
import { useThreadBundle } from "@/lib/use-thread-bundle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function panelLabel(label: string) {
  return (
    <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
      {label}
    </div>
  );
}

function MessageBlock({
  label,
  body,
  kind,
}: {
  label: string;
  body: string;
  kind: string;
}) {
  return (
    <div className={kind === "tool" ? "border border-[var(--border)] bg-white/[0.018] px-4 py-4" : "max-w-[920px]"}>
      <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div
        className={
          kind === "tool"
            ? "mt-2 whitespace-pre-wrap nipux-mono text-[12px] tracking-[0.04em] text-[var(--foreground)]/78"
            : "mt-3 whitespace-pre-wrap text-[16px] leading-[1.78] text-[var(--foreground)]/92"
        }
      >
        {body}
      </div>
    </div>
  );
}

export function ChatView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<{ status: string; taskCount: number } | null>(null);

  const agents = useMemo(() => summary?.agents ?? [], [summary?.agents]);
  const runs = useMemo(() => summary?.runs ?? [], [summary?.runs]);

  useEffect(() => {
    if (!selectedAgentId && agents[0]) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) {
      setThreads([]);
      setSelectedThreadId(null);
      return;
    }
    let active = true;
    getThreads(selectedAgentId)
      .then((rows) => {
        if (!active) return;
        setThreads(rows);
        setSelectedThreadId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
      })
      .catch((err) => {
        if (!active) return;
        setActionError(err instanceof Error ? err.message : "Failed to load chats.");
      });
    return () => {
      active = false;
    };
  }, [selectedAgentId]);

  const { bundle } = useThreadBundle(selectedThreadId);
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId],
  );
  const activeRun = useMemo(
    () => runs.find((run) => run.thread_id === selectedThreadId && ["queued", "planning", "running", "paused"].includes(run.status)) ?? null,
    [runs, selectedThreadId],
  );

  useEffect(() => {
    if (!activeRun?.id) {
      setRunDetail(null);
      return;
    }
    let active = true;
    getRun(activeRun.id)
      .then((run) => {
        if (!active) return;
        setRunDetail({ status: run.status, taskCount: run.tasks.length });
      })
      .catch(() => {
        if (!active) return;
        setRunDetail(null);
      });
    return () => {
      active = false;
    };
  }, [activeRun?.id, bundle?.messages.length]);

  async function handleNewChat() {
    if (!selectedAgentId) return;
    setPending(true);
    setActionError(null);
    try {
      const thread = await createThread({ agent_id: selectedAgentId });
      const nextThreads = await getThreads(selectedAgentId);
      setThreads(nextThreads);
      setSelectedThreadId(thread.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create chat.");
    } finally {
      setPending(false);
    }
  }

  async function handleSend() {
    if (!selectedThreadId || !message.trim()) return;
    setPending(true);
    setActionError(null);
    const body = message.trim();
    setMessage("");
    try {
      await sendThreadMessage(selectedThreadId, body);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send message.");
      setMessage(body);
    } finally {
      setPending(false);
    }
  }

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center nipux-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Loading chats...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-6 text-[15px] text-[var(--muted-foreground)]">
          {error ?? "Chats are unavailable."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="grid h-[calc(100vh-52px)] min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_400px]">
        <aside className="min-h-0 border-r border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-5 py-5">
            {panelLabel("chats")}
            <div className="mt-4 grid gap-3">
              <select
                value={selectedAgentId ?? ""}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                className="h-11 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--foreground)] outline-none"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id} className="bg-[var(--background)]">
                    {agent.name}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => void handleNewChat()} disabled={pending || !selectedAgentId}>
                New chat
              </Button>
            </div>
          </div>

          <div className="min-h-0 overflow-auto px-3 py-3">
            {threads.length ? (
              threads.map((thread) => {
                const active = thread.id === selectedThreadId;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full border-b border-[var(--border)] px-3 py-4 text-left transition-colors ${
                      active ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="text-[15px] text-[var(--foreground)]">{thread.title}</div>
                    <div className="mt-2 nipux-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      {thread.status}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-[14px] leading-[1.7] text-[var(--muted-foreground)]">
                No chats yet. Create one and assign work to the selected agent.
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                {panelLabel("conversation")}
                <h1 className="mt-3 text-[34px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
                  {bundle?.thread.title ?? "No chat selected"}
                </h1>
              </div>
              <div className="flex gap-2">
                <Badge variant={selectedAgent?.status === "running" ? "success" : "secondary"}>
                  {selectedAgent?.status === "running" ? "agent live" : "agent idle"}
                </Badge>
                {activeRun ? <Badge variant="secondary">{activeRun.status}</Badge> : null}
              </div>
            </div>
            {actionError ? <p className="mt-4 text-[14px] text-[#d8a499]">{actionError}</p> : null}
          </header>

          <div className="flex-1 overflow-auto px-5 py-6 md:px-8 md:py-8">
            <div className="space-y-8">
              {bundle?.messages.length ? (
                bundle.messages.map((item) => (
                  <MessageBlock key={item.id} label={item.label} body={item.body} kind={item.kind} />
                ))
              ) : (
                <div className="text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  Start a chat and give the agent a concrete task.
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-[var(--border)] px-5 py-5 md:px-8">
            <div className="grid gap-3">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell the selected agent what to do..."
                disabled={!selectedThreadId || pending}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={() => void handleSend()} disabled={!selectedThreadId || pending || !message.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </footer>
        </div>

        <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <div className="border-b border-[var(--border)] px-5 py-5">
            {panelLabel("session")}
            <div className="mt-4 space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
              <div>Agent: {selectedAgent?.name ?? "None"}</div>
              <div>Run: {runDetail?.status ?? activeRun?.status ?? "idle"}</div>
              <div>Tasks: {String(runDetail?.taskCount ?? 0)}</div>
              <div>Endpoint: {summary.runtime_state.endpoint ?? summary.settings.openai_base_url ?? "Not configured"}</div>
            </div>
          </div>

          <div className="min-h-0">
            <BrowserPane agentId={selectedAgent?.id} title="browser" compact />
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
