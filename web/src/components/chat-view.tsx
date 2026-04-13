"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSummary, startNode, stopNode } from "@/lib/api";
import type { NipuxSummary } from "@/lib/types";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function ChatView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const next = await getSummary();
      if (mounted) setSummary(next);
    };

    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const activeNode = useMemo(() => {
    if (!summary) return null;
    return summary.nodes.find((node) => node.status === "active") ?? summary.nodes[0] ?? null;
  }, [summary]);

  if (!summary || !activeNode) {
    return (
      <AppShell>
        <div className="px-10 py-10">
          <div className="nipux-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            Synchronizing_focus_surface
          </div>
        </div>
      </AppShell>
    );
  }

  const toggleActiveNode = async () => {
    setPending(true);
    const next =
      activeNode.status === "active"
        ? await stopNode(activeNode.id)
        : await startNode(activeNode.id);
    setSummary(next);
    setPending(false);
  };

  return (
    <AppShell telemetry={summary.telemetry}>
      <section className="grid min-h-[calc(100vh-72px)] xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
        <div className="relative border-b border-r border-[var(--border)] xl:border-b-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_18%),radial-gradient(circle_at_80%_12%,rgba(255,255,255,0.04),transparent_18%),radial-gradient(circle_at_76%_84%,rgba(255,255,255,0.04),transparent_16%)]" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute left-[7%] top-[8%] h-[62%] w-[76%] border border-[var(--border)]" />
            <div className="absolute left-[7%] top-[32%] h-[50%] w-[44%] border border-[var(--border)]" />
            <div className="absolute left-[51%] top-[58%] h-[24%] w-[32%] border border-[var(--border)]" />
          </div>

          <div className="relative flex h-full flex-col px-10 py-8">
            <div className="flex items-center justify-between">
              <div className="nipux-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                Visual_core_01
              </div>
              <div className="nipux-mono text-[12px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                TPS: {activeNode.tokens_per_sec.toFixed(1)} {"//"} Latency: {activeNode.latency_ms.toFixed(0)}MS
              </div>
            </div>

            <div className="mt-12 max-w-[360px] border-l border-[var(--border)] pl-6">
              <div className="nipux-mono text-[12px] uppercase tracking-[0.22em]">Focus_surface</div>
              <div className="mt-3 nipux-mono text-[18px] uppercase leading-8 text-[var(--muted-foreground)]">
                Node: {activeNode.identifier}
                <br />
                Model: {activeNode.model}
                <br />
                State: {activeNode.status}
                <br />
                Tokens: {formatCount(activeNode.total_tokens)}
              </div>
            </div>

            <div className="pointer-events-none relative mt-20 flex-1">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="nipux-display text-[180px] uppercase leading-none tracking-[0.04em] text-white/[0.06]">
                  Focus
                </div>
              </div>
            </div>

            <div className="grid gap-px border-t border-[var(--border)] bg-[var(--border)] md:grid-cols-4">
              <div className="bg-[var(--surface)] px-5 py-4">
                <div className="nipux-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Model
                </div>
                <div className="mt-2 nipux-mono text-[13px] uppercase tracking-[0.12em]">{activeNode.model}</div>
              </div>
              <div className="bg-[var(--surface)] px-5 py-4">
                <div className="nipux-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Tokens/sec
                </div>
                <div className="mt-2 nipux-mono text-[13px] uppercase tracking-[0.12em]">
                  {activeNode.tokens_per_sec.toFixed(1)}
                </div>
              </div>
              <div className="bg-[var(--surface)] px-5 py-4">
                <div className="nipux-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Latency
                </div>
                <div className="mt-2 nipux-mono text-[13px] uppercase tracking-[0.12em]">
                  {activeNode.latency_ms.toFixed(0)}MS
                </div>
              </div>
              <div className="bg-[var(--surface)] px-5 py-4">
                <div className="nipux-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Connection
                </div>
                <div className="mt-2 nipux-mono text-[13px] uppercase tracking-[0.12em]">
                  {summary.runtime_state.endpoint ? "LOCAL_SECURE" : "UNBOUND"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex min-h-[calc(100vh-72px)] flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <span className="h-3 w-3 border border-[var(--border)] bg-white/20" />
                <span className="h-3 w-3 border border-[var(--border)] bg-white/12" />
                <span className="h-3 w-3 border border-[var(--border)] bg-white/8" />
              </div>
              <div className="nipux-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                Runtime_log_v.2.0.4
              </div>
            </div>
            <Badge variant={summary.hermes.installed ? "secondary" : "default"}>
              {summary.hermes.installed ? "Hermes_online" : "Install_hermes"}
            </Badge>
          </div>

          <div className="flex-1 overflow-auto bg-[var(--surface-2)] px-8 py-8">
            <div className="space-y-5">
              {summary.log_lines.map((line, index) => (
                <div key={`${line}-${index}`} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
                  <div className="nipux-mono text-[12px] uppercase tracking-[0.16em] text-white/28">
                    [{String(index + 1).padStart(2, "0")}]
                  </div>
                  <div className="nipux-mono text-[16px] leading-8 text-[var(--foreground)]">{line}</div>
                </div>
              ))}
              <div className="nipux-mono text-[22px] text-[var(--foreground)]">&gt; _</div>
            </div>
          </div>

          <div className="grid gap-px border-t border-[var(--border)] bg-[var(--border)]">
            <div className="grid gap-px bg-[var(--border)] md:grid-cols-2">
              <div className="bg-[var(--surface)] px-8 py-5">
                <div className="nipux-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Prompt_tokens
                </div>
                <div className="mt-2 text-[34px] leading-none">{formatCount(summary.usage_summary.prompt_tokens)}</div>
              </div>
              <div className="bg-[var(--surface)] px-8 py-5">
                <div className="nipux-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Completion_tokens
                </div>
                <div className="mt-2 text-[34px] leading-none">{formatCount(summary.usage_summary.completion_tokens)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-[var(--surface)] px-8 py-5">
              <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                {summary.runtime_state.active_model_id || summary.settings.model || "UNASSIGNED"}
              </div>
              <Button variant={activeNode.status === "active" ? "outline" : "default"} size="sm" onClick={toggleActiveNode} disabled={pending}>
                {pending ? "SYNCING" : activeNode.status === "active" ? "Stop_node" : "Start_node"}
              </Button>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
