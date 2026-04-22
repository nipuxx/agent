"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { apiUrl, getAgentBrowser, sendBrowserCommand } from "@/lib/api";
import type { BrowserSession } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BrowserPane({
  agentId,
  title = "browser",
  compact = false,
  showControls = true,
}: {
  agentId: string | null | undefined;
  title?: string;
  compact?: boolean;
  showControls?: boolean;
}) {
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

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
        setUrl(next.current_url && next.current_url !== "about:blank" ? next.current_url : "");
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
      setUrl(next.current_url && next.current_url !== "about:blank" ? next.current_url : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Browser command failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleFrameClick(event: MouseEvent<HTMLImageElement>) {
    if (!session?.id || session.control_mode !== "manual" || pending) {
      return;
    }
    const image = imageRef.current;
    if (!image) return;

    const rect = image.getBoundingClientRect();
    const naturalWidth = image.naturalWidth || 1;
    const naturalHeight = image.naturalHeight || 1;
    const naturalRatio = naturalWidth / naturalHeight;
    const boxRatio = rect.width / rect.height;

    let renderedWidth = rect.width;
    let renderedHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (naturalRatio > boxRatio) {
      renderedHeight = rect.width / naturalRatio;
      offsetY = (rect.height - renderedHeight) / 2;
    } else {
      renderedWidth = rect.height * naturalRatio;
      offsetX = (rect.width - renderedWidth) / 2;
    }

    const localX = event.clientX - rect.left - offsetX;
    const localY = event.clientY - rect.top - offsetY;

    if (localX < 0 || localY < 0 || localX > renderedWidth || localY > renderedHeight) {
      return;
    }

    const scaledX = Math.round((localX / renderedWidth) * naturalWidth);
    const scaledY = Math.round((localY / renderedHeight) * naturalHeight);
    await act({ action: "click", x: scaledX, y: scaledY });
  }

  return (
    <div
      className={`grid h-full min-h-0 min-w-0 border border-[var(--border)] ${
        showControls ? "grid-rows-[auto_auto_minmax(0,1fr)_auto]" : "grid-rows-[auto_minmax(0,1fr)_auto]"
      }`}
    >
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            {title}
          </div>
          <div className="nipux-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {session?.control_mode === "manual" ? "manual" : "agent"}
          </div>
        </div>
      </div>

      {showControls ? (
        <div className="grid grid-cols-[minmax(0,1fr)_56px] gap-2 border-b border-[var(--border)] px-4 py-3">
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
      ) : null}

      <div className={`min-h-0 bg-black/20 ${compact ? "min-h-[340px]" : "min-h-[460px]"}`}>
        {frameSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imageRef}
            src={frameSrc}
            alt="Agent browser"
            className={`h-full w-full object-contain ${session?.control_mode === "manual" ? "cursor-crosshair" : "cursor-default"}`}
            onClick={(event) => void handleFrameClick(event)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[14px] text-[var(--muted-foreground)]">
            Browser frame unavailable.
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] text-[var(--foreground)]/88">{session?.title || "No page loaded"}</div>
          {!showControls ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void act({ action: session?.control_mode === "manual" ? "resume" : "pause" })}
              disabled={!session || pending}
            >
              {session?.control_mode === "manual" ? "Resume agent" : "Take control"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void act({ action: session?.control_mode === "manual" ? "resume" : "pause" })}
              disabled={!session || pending}
            >
              {session?.control_mode === "manual" ? "Resume" : "Control"}
            </Button>
          )}
        </div>
        {showControls ? (
          <div className="mt-2 truncate nipux-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {session?.current_url && session.current_url !== "about:blank" ? session.current_url : "NO_URL"}
          </div>
        ) : null}
        {session?.control_mode === "manual" ? (
          <div className="mt-2 text-[12px] text-[var(--muted-foreground)]">
            Manual control is active. Click inside the browser frame to drive it.
          </div>
        ) : null}
        {error ? <div className="mt-2 text-[13px] text-[#d8a499]">{error}</div> : null}
      </div>
    </div>
  );
}
