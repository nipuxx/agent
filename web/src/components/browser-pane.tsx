"use client";

import { useEffect, useMemo, useState } from "react";

import { apiUrl, getAgentBrowser, sendBrowserCommand } from "@/lib/api";
import type { BrowserSession } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


export function BrowserPane({
  agentId,
  title = "browser",
}: {
  agentId: string | null | undefined;
  title?: string;
}) {
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!agentId) {
      setSession(null);
      setUrl("");
      return;
    }
    const activeAgentId = agentId;

    let active = true;
    async function refresh() {
      try {
        const next = await getAgentBrowser(activeAgentId);
        if (!active) return;
        setSession(next);
        setUrl(next.current_url || "");
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load browser.");
      }
    }

    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [agentId]);

  const frameSrc = useMemo(() => {
    if (!session?.id) return null;
    return `${apiUrl(`/api/browser/${session.id}/frame`)}?ts=${session.updated_at}`;
  }, [session?.id, session?.updated_at]);

  async function act(payload: { action: string; [key: string]: unknown }) {
    if (!session?.id) return;
    setPending(true);
    setError(null);
    try {
      const next = await sendBrowserCommand(session.id, payload);
      setSession(next);
      if (next.current_url) setUrl(next.current_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Browser command failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-[420px] grid-rows-[auto_auto_minmax(0,1fr)] border border-[var(--border)]">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          {title}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Navigate or search"
            disabled={!session || pending}
          />
          <Button size="sm" onClick={() => void act({ action: "navigate", url })} disabled={!session || pending || !url.trim()}>
            Go
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <Button variant="outline" size="sm" onClick={() => void act({ action: "back" })} disabled={!session || pending}>
          Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => void act({ action: "snapshot" })} disabled={!session || pending}>
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void act({ action: session?.control_mode === "manual" ? "resume" : "pause" })}
          disabled={!session || pending}
        >
          {session?.control_mode === "manual" ? "Resume agent" : "Take control"}
        </Button>
      </div>

      <div className="grid min-h-0 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[280px] bg-black/20">
          {frameSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frameSrc} alt="Agent browser" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-[14px] text-[var(--muted-foreground)]">
              Browser frame unavailable.
            </div>
          )}
        </div>

        <div className="border-l border-[var(--border)] px-4 py-4">
          <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            live_state
          </div>
          <div className="mt-4 space-y-3 text-[14px] text-[var(--foreground)]/88">
            <div>{session?.title || "Untitled page"}</div>
            <div className="nipux-mono break-all text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              {session?.current_url || "NO_URL"}
            </div>
            {error ? <div className="text-[#d8a499]">{error}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
