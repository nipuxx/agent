"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";

import { AppShell } from "./app-shell";
import { createChatThread, getChatThreads, sendChatMessage } from "@/lib/api";
import { useChatBundle } from "@/lib/use-chat-bundle";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  role,
}: {
  label: string;
  body: string;
  role: string;
}) {
  const assistant = role === "assistant";
  return (
    <div
      className={cn(
        "max-w-[920px] border px-4 py-4",
        assistant ? "border-[var(--border)] bg-white/[0.02]" : "border-transparent bg-transparent px-0",
      )}
    >
      <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-3 whitespace-pre-wrap leading-[1.78]",
          assistant ? "text-[16px] text-[var(--foreground)]/92" : "text-[15px] text-[var(--foreground)]/82",
        )}
      >
        {body}
      </div>
    </div>
  );
}

export function ChatView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [threads, setThreads] = useState<Array<{ id: string; title: string; status: string; last_error?: string | null }>>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  async function loadThreads() {
    const rows = await getChatThreads();
    setThreads(rows);
    setSelectedThreadId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
    return rows;
  }

  useEffect(() => {
    let active = true;
    loadThreads().catch((err) => {
      if (!active) return;
      setActionError(err instanceof Error ? err.message : "Failed to load chats.");
    });
    return () => {
      active = false;
    };
  }, []);

  const { bundle } = useChatBundle(selectedThreadId);
  const selectedThread = bundle?.thread ?? threads.find((thread) => thread.id === selectedThreadId) ?? null;

  const threadTokenTotal = useMemo(
    () => bundle?.messages.reduce((sum, item) => sum + Number(item.total_tokens || 0), 0) ?? 0,
    [bundle?.messages],
  );

  async function handleNewChat() {
    setPending(true);
    setActionError(null);
    try {
      const thread = await createChatThread();
      await loadThreads();
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
      await sendChatMessage(selectedThreadId, body);
      await Promise.all([loadThreads(), refresh()]);
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
          Loading chat...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-6 text-[15px] text-[var(--muted-foreground)]">
          {error ?? "Chat is unavailable."}
        </div>
      </AppShell>
    );
  }

  const modelLabel = summary.runtime_state.active_model_id || summary.settings.openai_model || "No model configured";

  return (
    <AppShell>
      <section className="grid h-[calc(100vh-52px)] min-h-0 min-w-0 overflow-hidden grid-cols-[auto_minmax(0,1fr)]">
        <aside
          className={cn(
            "min-h-0 border-r border-[var(--border)] transition-[width] duration-200",
            sidebarCollapsed ? "w-[72px]" : "w-[300px]",
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-[var(--border)] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                {!sidebarCollapsed ? panelLabel("chats") : <div className="h-[16px]" />}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  aria-label={sidebarCollapsed ? "Expand chats" : "Collapse chats"}
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              </div>
              <div className={cn("mt-3 grid gap-2", sidebarCollapsed && "justify-center")}>
                <Button
                  size={sidebarCollapsed ? "icon" : "sm"}
                  variant="secondary"
                  onClick={() => void handleNewChat()}
                  disabled={pending}
                  className={cn(sidebarCollapsed && "w-10")}
                >
                  <Plus className="h-4 w-4" />
                  {!sidebarCollapsed ? "New chat" : null}
                </Button>
              </div>
            </div>

            <div className="min-h-0 overflow-auto py-2">
              {threads.length ? (
                threads.map((thread, index) => {
                  const active = thread.id === selectedThreadId;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={cn(
                        "w-full border-b border-[var(--border)] text-left transition-colors",
                        active ? "bg-white/[0.03]" : "hover:bg-white/[0.02]",
                        sidebarCollapsed ? "px-2 py-3" : "px-4 py-4",
                      )}
                    >
                      {sidebarCollapsed ? (
                        <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] nipux-mono text-[11px] uppercase tracking-[0.14em] text-[var(--foreground)]/78">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                      ) : (
                        <>
                          <div className="truncate text-[15px] text-[var(--foreground)]">{thread.title}</div>
                          <div className="mt-2 nipux-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                            {thread.status}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className={cn("px-4 py-4 text-[14px] leading-[1.7] text-[var(--muted-foreground)]", sidebarCollapsed && "hidden")}>
                  No chats yet. Start one and talk directly to the model.
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {panelLabel("direct chat")}
                <h1 className="mt-3 truncate text-[34px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
                  {selectedThread?.title ?? "No chat selected"}
                </h1>
                <p className="mt-3 max-w-[920px] text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  One-on-one model chat with live Nipux context from runtime state, agents, runs, and recent system activity.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={summary.runtime_state.model_loaded ? "success" : "secondary"}>
                  {summary.runtime_state.model_loaded ? "model live" : "runtime idle"}
                </Badge>
                <Badge variant="secondary">{modelLabel}</Badge>
                {selectedThread ? <Badge variant="secondary">{threadTokenTotal} tokens</Badge> : null}
              </div>
            </div>
            {actionError ? <p className="mt-4 text-[14px] text-[#d8a499]">{actionError}</p> : null}
          </header>

          <div className="flex-1 overflow-auto px-5 py-6 md:px-8 md:py-8">
            <div className="space-y-8">
              {bundle?.messages.length ? (
                bundle.messages.map((item) => (
                  <MessageBlock key={item.id} label={item.label} body={item.body} role={item.role} />
                ))
              ) : (
                <div className="text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  Start a chat and ask the model anything about the system or your work.
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-[var(--border)] px-5 py-5 md:px-8">
            <div className="grid gap-3">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Send a message to the model..."
                disabled={!selectedThreadId || pending}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] leading-[1.7] text-[var(--muted-foreground)]">
                  This chat is separate from agents and does not use the browser or run harness.
                </div>
                <Button size="sm" onClick={() => void handleSend()} disabled={!selectedThreadId || pending || !message.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </AppShell>
  );
}
