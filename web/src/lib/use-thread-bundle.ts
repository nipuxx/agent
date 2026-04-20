"use client";

import { useEffect, useState } from "react";

import { getThreadBundle, openEventStream } from "./api";
import type { ThreadBundle } from "./types";


export function useThreadBundle(threadId: string | null) {
  const [bundle, setBundle] = useState<ThreadBundle | null>(null);
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
        const next = await getThreadBundle(activeThreadId);
        if (!active) return;
        setBundle(next);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load thread.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();
    const stream = openEventStream(`/api/threads/${activeThreadId}/events`);
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
