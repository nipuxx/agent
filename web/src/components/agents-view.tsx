"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "./app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSummary, startNode, stopNode } from "@/lib/api";
import type { NipuxSummary, NodeSummary } from "@/lib/types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatUptime(seconds: number) {
  if (!seconds) return "Standby";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

function NodeControl({
  node,
  pending,
  onToggle,
}: {
  node: NodeSummary;
  pending: boolean;
  onToggle: () => void;
}) {
  const active = node.status === "active";

  return (
    <article className="nipux-panel grid min-h-[308px] grid-rows-[auto_1fr_auto]">
      <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-5">
        <div>
          <div className="nipux-mono text-[11px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">
            {node.identifier}
          </div>
          <div className="mt-2 nipux-display text-[52px] uppercase leading-[0.88]">{node.label}</div>
        </div>
        <Badge variant={active ? "default" : "secondary"}>{active ? "Active" : "Idle"}</Badge>
      </div>

      <div className="grid gap-4 px-6 py-5">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Mode
          </span>
          <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">{node.mode}</span>
        </div>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Runtime
          </span>
          <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">
            {node.tokens_per_sec.toFixed(1)} TOK/S
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Uptime
          </span>
          <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">
            {formatUptime(node.uptime_seconds)}
          </span>
        </div>
        <div className="nipux-mono text-[12px] uppercase leading-6 tracking-[0.14em] text-[var(--muted-foreground)]">
          {node.description}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-5">
        <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
          {formatNumber(node.total_tokens)} total tokens
        </div>
        <Button variant={active ? "outline" : "default"} size="sm" onClick={onToggle} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? "Stop_node" : "Start_node"}
        </Button>
      </div>
    </article>
  );
}

export function AgentsView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

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

  if (!summary) {
    return (
      <AppShell>
        <div className="px-10 py-10">
          <div className="nipux-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            Loading_node_roster
          </div>
        </div>
      </AppShell>
    );
  }

  const runAction = async (target: string, task: () => Promise<NipuxSummary>) => {
    setPendingTarget(target);
    const next = await task();
    setSummary(next);
    setPendingTarget(null);
  };

  return (
    <AppShell telemetry={summary.telemetry}>
      <section className="border-b border-[var(--border)] px-10 py-10">
        <div className="nipux-mono text-[12px] uppercase tracking-[0.3em] text-[var(--muted-foreground)]">
          Node_fabric
        </div>
        <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <h1 className="nipux-display text-[108px] uppercase leading-[0.84]">Node_Control</h1>
            <p className="mt-4 max-w-[760px] text-[28px] leading-[1.22] text-[var(--muted-foreground)]">
              Start, stop, and monitor isolated Hermes-backed nodes without coupling Nipux to
              Hermes internals.
            </p>
          </div>
          <div className="nipux-panel-soft px-6 py-6">
            <div className="grid gap-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Runtime
                </span>
                <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">
                  {summary.runtime_state.model_loaded ? "MODEL_LOADED" : "RUNTIME_OFFLINE"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Active nodes
                </span>
                <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">
                  {summary.telemetry.active_nodes}/{summary.telemetry.node_count}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Hermes mode
                </span>
                <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">
                  {summary.hermes.gateway_running ? "GATEWAY" : "CLI_BRIDGE"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Current model
                </span>
                <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">
                  {summary.runtime_state.active_model_id || summary.settings.model || "UNASSIGNED"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-px bg-[var(--border)] xl:grid-cols-2 2xl:grid-cols-4">
        {summary.nodes.map((node) => (
          <NodeControl
            key={node.id}
            node={node}
            pending={pendingTarget === node.id}
            onToggle={() =>
              runAction(node.id, () =>
                node.status === "active" ? stopNode(node.id) : startNode(node.id),
              )
            }
          />
        ))}
      </section>
    </AppShell>
  );
}
