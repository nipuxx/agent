"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";

import { AppShell } from "./app-shell";
import { ChatMessageBubble } from "./chat-message-bubble";
import { apiUrl, createChatThread, deleteChatThread, getChatThreads } from "@/lib/api";
import { useChatBundle } from "@/lib/use-chat-bundle";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PendingMessage = { id: string; label: string; body: string; role: string };

function panelLabel(label: string) {
  return (
    <div className="nipux-label">
      {label}
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
  const [streamingText, setStreamingText] = useState("");
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);

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

  const { bundle, refresh: refreshBundle } = useChatBundle(selectedThreadId);
  const selectedThread = bundle?.thread ?? threads.find((thread) => thread.id === selectedThreadId) ?? null;
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

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [persistedMessageIdKey, visiblePendingMessages.length, streamingText]);

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

  async function handleDeleteChat() {
    if (!selectedThreadId) return;
    setPending(true);
    setActionError(null);
    try {
      await deleteChatThread(selectedThreadId);
      setPendingMessages([]);
      setStreamingText("");
      await loadThreads();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete chat.");
    } finally {
      setPending(false);
    }
  }

  async function handleSend() {
    if (!message.trim()) return;
    setPending(true);
    setActionError(null);
    const body = message.trim();
    const optimisticUserId = `pending-user-${Date.now()}`;
    setMessage("");
    setStreamingText("");
    setPendingMessages([
      {
        id: optimisticUserId,
        label: "user",
        body,
        role: "user",
      },
    ]);
    try {
      let threadId = selectedThreadId;
      if (!threadId) {
        const thread = await createChatThread();
        threadId = thread.id;
        setSelectedThreadId(thread.id);
        setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
      }
      const response = await fetch(apiUrl(`/api/chat/threads/${threadId}/stream`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok || !response.body) {
        throw new Error((await response.text()) || "Failed to stream message.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const applyBlock = (block: string) => {
        const line = block
          .split("\n")
          .find((item) => item.startsWith("data:"));
        if (!line) return;
        const payload = JSON.parse(line.slice(5).trim()) as {
          type: string;
          content?: string;
          error?: string;
          message?: { id?: string; label?: string; body?: string; role?: string };
        };
        if (payload.type === "delta") {
          setStreamingText((current) => current + String(payload.content ?? ""));
        } else if (payload.type === "user" && payload.message) {
          const serverMessage = payload.message;
          setPendingMessages((current) => [
            ...current.filter((item) => item.id !== optimisticUserId && item.id !== serverMessage.id),
            {
              id: serverMessage.id || `temp-user-${Date.now()}`,
              label: serverMessage.label || "user",
              body: serverMessage.body || body,
              role: serverMessage.role || "user",
            },
          ]);
        } else if (payload.type === "done" && payload.message) {
          const serverMessage = payload.message;
          setPendingMessages((current) => {
            const next = current.filter((item) => item.role !== "assistant" && item.id !== serverMessage.id);
            return [
              ...next,
              {
                id: serverMessage.id || `temp-assistant-${Date.now()}`,
                label: serverMessage.label || "assistant",
                body: serverMessage.body || "",
                role: serverMessage.role || "assistant",
              },
            ];
          });
        } else if (payload.type === "error") {
          throw new Error(payload.error || "Streaming failed.");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          applyBlock(block);
        }
      }
      setStreamingText("");
      if (buffer.trim()) {
        applyBlock(buffer);
      }
      await Promise.all([loadThreads(), refresh(), refreshBundle()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send message.");
      setMessage(body);
      setStreamingText("");
      setPendingMessages([]);
    } finally {
      setPending(false);
    }
  }

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center nipux-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Loading chat...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center px-6 text-[15px] text-[var(--muted-foreground)]">
          {error ?? "Chat is unavailable."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="grid h-[100dvh] min-h-0 min-w-0 overflow-hidden grid-cols-[auto_minmax(0,1fr)]">
        <aside
          className={cn(
            "min-h-0 border-r border-[var(--border)] transition-[width] duration-200",
            sidebarCollapsed ? "w-[64px]" : "w-[clamp(220px,22vw,340px)]",
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
                        active ? "bg-[var(--active-surface)]" : "hover:bg-[var(--hover-surface)]",
                        sidebarCollapsed ? "px-2 py-3" : "px-4 py-4",
                      )}
                    >
                      {sidebarCollapsed ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] nipux-mono text-[11px] uppercase tracking-[var(--label-letter-spacing)] text-[var(--foreground)]/78">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                      ) : (
                        <>
                          <div className="truncate text-[15px] text-[var(--foreground)]">{thread.title}</div>
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

        <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <header className="border-b border-[var(--border)] px-[clamp(14px,3vw,32px)] py-[clamp(12px,1.8vw,20px)]">
            <div className="nipux-chat-column">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  {panelLabel("direct chat")}
                  <h1 className="nipux-title mt-2 truncate text-[clamp(22px,2.5vw,30px)] text-[var(--foreground)]">
                    {selectedThread?.title ?? "No chat selected"}
                  </h1>
                </div>
                {selectedThread ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDeleteChat()}
                    disabled={pending}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
            {actionError ? <p className="mt-4 text-[14px] text-[var(--danger)]">{actionError}</p> : null}
          </header>

          <div
            ref={messageViewportRef}
            className="min-h-0 overflow-y-auto px-[clamp(14px,4vw,48px)] py-[clamp(14px,2.6vw,30px)]"
          >
            <div className="nipux-message-list">
              {bundle?.messages.length || visiblePendingMessages.length || streamingText ? (
                <>
                  {(bundle?.messages ?? []).map((item) => (
                    <ChatMessageBubble key={item.id} label={item.label} body={item.body} role={item.role} />
                  ))}
                  {visiblePendingMessages.map((item) => (
                    <ChatMessageBubble key={item.id} label={item.label} body={item.body} role={item.role} />
                  ))}
                  {streamingText ? <ChatMessageBubble label="assistant" body={streamingText} role="assistant" /> : null}
                </>
              ) : (
                <div className="text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  Start a chat and ask the model anything about the system or your work.
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-[var(--border)] px-[clamp(14px,4vw,48px)] py-[clamp(10px,1.6vw,16px)]">
            <div className="nipux-chat-column grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Send a message to the model..."
                disabled={pending}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button size="sm" onClick={() => void handleSend()} disabled={pending || !message.trim()}>
                Send
              </Button>
            </div>
          </footer>
        </div>
      </section>
    </AppShell>
  );
}
