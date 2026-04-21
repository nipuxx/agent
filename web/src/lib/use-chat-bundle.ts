"use client";

import { useEffect, useState } from "react";

import { getChatBundle, openEventStream } from "./api";
import type { ChatBundle } from "./types";


export function useChatBundle(threadId: string | null) {
  const [bundle, setBundle] = useState<ChatBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) {
      setBundle(null);
      setLoading(false);
      setError(null);
      return;
    }

    const activeThreadId = threadId;
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      try {
        setLoading(true);
        const next = await getChatBundle(activeThreadId);
        if (!active) return;
        setBundle(next);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load chat.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();
    const stream = openEventStream(`/api/chat/threads/${activeThreadId}/events`);
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void refresh();
      }, 80);
    };

    stream.onmessage = scheduleRefresh;
    stream.onerror = scheduleRefresh;

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      stream.close();
    };
  }, [threadId]);

  return { bundle, loading, error };
}
