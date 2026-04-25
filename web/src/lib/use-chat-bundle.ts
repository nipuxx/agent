"use client";

import { useCallback, useEffect, useState } from "react";

import { getChatBundle, openEventStream } from "./api";
import type { ChatBundle } from "./types";


export function useChatBundle(threadId: string | null) {
  const [bundle, setBundle] = useState<ChatBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!threadId) {
      setBundle(null);
      setLoading(false);
      setError(null);
      return null;
    }

    try {
      setLoading(true);
      const next = await getChatBundle(threadId);
      setBundle(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [threadId]);

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

    void refresh();
    const stream = openEventStream(`/api/chat/threads/${activeThreadId}/events`);
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (active) void refresh();
      }, 80);
    };

    stream.onmessage = scheduleRefresh;
    stream.onerror = scheduleRefresh;

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      stream.close();
    };
  }, [threadId, refresh]);

  return { bundle, loading, error, refresh };
}
