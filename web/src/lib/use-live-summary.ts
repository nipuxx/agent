"use client";

import { useEffect, useState } from "react";

import { getSummary, openEventStream } from "./api";
import type { NipuxSummary } from "./types";


export function useLiveSummary() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      try {
        const next = await getSummary();
        if (!active) return;
        setSummary(next);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load Nipux summary.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();

    const stream = openEventStream("/api/events/stream");
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void refresh();
      }, 120);
    };

    stream.onmessage = scheduleRefresh;
    stream.onerror = () => {
      scheduleRefresh();
    };
    stream.addEventListener("heartbeat", () => {});

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      stream.close();
    };
  }, []);

  return { summary, loading, error, refresh: () => getSummary().then(setSummary) };
}
