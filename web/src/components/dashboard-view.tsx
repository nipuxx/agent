"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AppShell } from "./app-shell";
import { Button } from "@/components/ui/button";
import { getSummary, loadModel, startNode, stopNode, unloadModel } from "@/lib/api";
import type { NipuxSummary, NodeSummary } from "@/lib/types";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function compactModelLabel(model: string) {
  const lower = model.toLowerCase();
  if (lower.includes("35b-a3b")) return "QWEN3.5-35B-A3B";
  if (lower.includes("27b")) return "CARNICE-27B";
  if (lower.includes("9b")) return "CARNICE-9B";
  return model.split("/").pop()?.split(":")[0]?.toUpperCase() ?? model.toUpperCase();
}

function compactLogLine(line: string) {
  const flattened = line.replace(/\s+/g, " ").trim();
  if (flattened.length <= 102) return flattened;
  return `${flattened.slice(0, 99)}...`;
}

function formatUptime(startedAt?: number | null) {
  if (!startedAt) return "000:00:00";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - startedAt));
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  return `${String(hours).padStart(3, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function trendLabel(node: NodeSummary) {
  if (node.status === "active" && node.tokens_per_sec > 18) return "HEAVY_LOAD";
  if (node.status === "active") return "USAGE_TREND";
  return "STANDBY_MODE";
}

function metricsFromSummary(summary: NipuxSummary) {
  const throughput = summary.telemetry.total_throughput_tps;
  const cpu = Math.max(summary.telemetry.cpu_percent, 1);
  const network = Math.min(
    99.99,
    98.9 + (summary.telemetry.active_nodes / Math.max(summary.telemetry.node_count, 1)) * 0.92,
  );
  const efficiency = Math.min(0.99, throughput / (cpu * 3.8));
  return {
    throughput,
    network,
    efficiency,
  };
}

function NodeCard({
  node,
  cardLabel,
  pending,
  onToggle,
}: {
  node: NodeSummary;
  cardLabel: string;
  pending: boolean;
  onToggle: () => void;
}) {
  const active = node.status === "active";

  return (
    <article className="flex min-h-[398px] flex-col border-r border-[var(--border)] px-7 py-7 last:border-r-0 xl:min-h-[424px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="nipux-mono text-[10px] uppercase tracking-[0.3em] text-[var(--muted-foreground)]">
            NODE_IDENTIFIER
          </div>
          <div className="mt-4 nipux-display text-[58px] uppercase leading-[0.86] lg:text-[64px]">
            {cardLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="h-2.5 w-2.5 bg-white/35" />
          <span className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--foreground)]">
            {active ? "ACTIVE" : "IDLE"}
          </span>
        </div>
      </div>

      <div className="mt-12 grid gap-5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <span className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              MODEL
            </span>
            <span className="nipux-mono text-[12px] uppercase tracking-[0.12em]">{compactModelLabel(node.model)}</span>
          </div>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <span className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            LATENCY
          </span>
          <span className="nipux-mono text-[12px] uppercase tracking-[0.12em]">
            {node.latency_ms.toFixed(0)}MS
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <span className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            TOKENS/SEC
          </span>
          <span className="nipux-mono text-[12px] uppercase tracking-[0.12em]">
            {node.tokens_per_sec.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="mt-auto pt-14">
        <div className="flex h-[82px] items-end gap-3">
          {node.trend.slice(0, 6).map((value, index) => (
            <div
              key={`${node.id}-${index}`}
              className={active ? (index % 2 === 0 ? "bg-white" : "bg-white/75") : "bg-white/10"}
              style={{ width: "14.8%", height: `${Math.max(14, Math.min(74, value))}px` }}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="nipux-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            {trendLabel(node)}
          </span>
          <span className="nipux-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            T: {formatCount(node.total_tokens)}
          </span>
        </div>
      </div>

      <div className="mt-6 xl:hidden">
        <Button variant={active ? "outline" : "default"} size="sm" onClick={onToggle} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? "STOP_NODE" : "DEPLOY_NODE"}
        </Button>
      </div>
    </article>
  );
}

function SlotCard({
  runtimeLoaded,
  pending,
  onLoadToggle,
}: {
  runtimeLoaded: boolean;
  pending: boolean;
  onLoadToggle: () => void;
}) {
  return (
    <article className="flex min-h-[398px] flex-col items-center justify-center gap-8 px-8 py-7 xl:min-h-[424px]">
      <div className="flex h-[92px] w-[92px] items-center justify-center border border-dashed border-white/35 text-white/75">
        <Plus className="h-9 w-9" strokeWidth={1.2} />
      </div>
      <div className="text-center">
        <div className="nipux-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          INITIALIZE_SLOT_04
        </div>
      </div>
      <Button variant={runtimeLoaded ? "outline" : "default"} size="sm" onClick={onLoadToggle} disabled={pending}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : runtimeLoaded ? "UNLOAD" : "DEPLOY"}
      </Button>
    </article>
  );
}

export function DashboardView({ initialSummary }: { initialSummary?: NipuxSummary | null }) {
  const [summary, setSummary] = useState<NipuxSummary | null>(initialSummary ?? null);
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

  const metrics = useMemo(() => (summary ? metricsFromSummary(summary) : null), [summary]);

  if (!summary || !metrics) {
    return (
      <AppShell>
        <div className="px-8 py-8">
          <div className="nipux-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            BOOTING_NIPUX_SURFACE
          </div>
        </div>
      </AppShell>
    );
  }

  const topNodes = summary.nodes.slice(0, 3);
  const displayLogLines = summary.log_lines.slice(0, 10).map(compactLogLine);

  const runAction = async (target: string, task: () => Promise<NipuxSummary>) => {
    setPendingTarget(target);
    const next = await task();
    setSummary(next);
    setPendingTarget(null);
  };

    return (
    <AppShell telemetry={summary.telemetry}>
      <div className="grid min-h-[calc(100vh-52px)] xl:grid-rows-[238px_392px_minmax(0,1fr)_28px]">
        <section className="border-b border-[var(--border)] px-10 pb-8 pt-8 lg:px-10 lg:pb-10">
          <div className="nipux-mono text-[12px] uppercase tracking-[0.32em] text-[var(--muted-foreground)]">
            SYSTEM_STATUS: {summary.hermes.installed && summary.settings.configured ? "OPTIMAL" : "CONFIG_REQUIRED"}
          </div>

          <div className="mt-5 flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-[760px]">
              <h1 className="nipux-display text-[88px] uppercase leading-[0.86] tracking-[0.01em] sm:text-[108px] xl:text-[150px]">
                AGENT_CONTROL
              </h1>
              <p className="mt-5 max-w-[700px] text-[22px] leading-[1.45] text-[var(--muted-foreground)] sm:text-[24px] xl:text-[26px]">
                Orchestrate high-precision agentic nodes across the local monolith cluster.
                Monitor token throughput and latency in real-time.
              </p>
            </div>

            <div className="flex items-center xl:self-end">
              <Button
                variant="default"
                className="h-[58px] min-w-[258px] border-white bg-white px-8 text-[14px] tracking-[0.22em] text-black"
                onClick={() =>
                  runAction("runtime", () =>
                    summary.runtime_state.model_loaded ? unloadModel() : loadModel(),
                  )
                }
                disabled={pendingTarget === "runtime"}
              >
                {pendingTarget === "runtime" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : summary.runtime_state.model_loaded ? (
                  "UNLOAD_RUNTIME"
                ) : (
                  "DEPLOY_NEW_NODE"
                )}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid border-b border-[var(--border)] xl:grid-cols-[1fr_1fr_1fr_300px]">
          {topNodes.map((node, index) => (
            <NodeCard
              key={node.id}
              node={node}
              cardLabel={`AGENT_${String(index + 1).padStart(2, "0")}`}
              pending={pendingTarget === node.id}
              onToggle={() =>
                runAction(node.id, () =>
                  node.status === "active" ? stopNode(node.id) : startNode(node.id),
                )
              }
            />
          ))}

          <SlotCard
            runtimeLoaded={summary.runtime_state.model_loaded}
            pending={pendingTarget === "runtime"}
            onLoadToggle={() =>
              runAction("runtime", () =>
                summary.runtime_state.model_loaded ? unloadModel() : loadModel(),
              )
            }
          />
        </section>

        <section className="grid min-h-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-0 overflow-hidden border-b border-r border-[var(--border)] px-10 py-8 xl:border-b-0">
            <div className="flex items-center justify-between">
              <div className="nipux-mono text-[14px] uppercase tracking-[0.28em]">TERMINAL_LOG_OUTPUT</div>
              <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                LIVE_STREAM_V0.9.1
              </div>
            </div>

            <div className="mt-10 max-h-[320px] space-y-4 overflow-hidden">
              {displayLogLines.map((line, index) => {
                const warning = /warn|error/i.test(line);
                return (
                  <div
                    key={`${line}-${index}`}
                    className={`nipux-mono text-[13px] uppercase leading-7 tracking-[0.08em] ${
                      warning ? "text-[#d9a28f]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {line}
                  </div>
                );
              })}
              <div className="nipux-mono text-[20px] uppercase">&gt; _</div>
            </div>
          </div>

          <aside className="min-h-0 overflow-hidden px-9 py-8">
            <div className="nipux-mono text-[14px] uppercase tracking-[0.28em]">CLUSTER_METRICS</div>

            <div className="mt-10 space-y-12">
              <div>
                <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  TOTAL THROUGHPUT
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-[72px] leading-none">{metrics.throughput.toFixed(1)}</span>
                  <span className="nipux-mono pb-2 text-[16px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    TOK/S
                  </span>
                </div>
                <div className="mt-4 border-b border-[var(--border)]" />
              </div>

              <div>
                <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  NETWORK STABILITY
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-[72px] leading-none">{metrics.network.toFixed(2)}</span>
                  <span className="nipux-mono pb-2 text-[16px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    %
                  </span>
                </div>
                <div className="mt-4 border-b border-[var(--border)]" />
              </div>

              <div>
                <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  COMPUTE EFFICIENCY
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-[72px] leading-none">{metrics.efficiency.toFixed(2)}</span>
                  <span className="nipux-mono pb-2 text-[16px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    RATIO
                  </span>
                </div>
                <div className="mt-4 border-b border-[var(--border)]" />
              </div>
            </div>
          </aside>
        </section>

        <footer className="flex items-center justify-between border-t border-[var(--border)] px-8">
          <div className="flex items-center gap-5 nipux-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            <span>■ SYSTEM_ONLINE</span>
            <span>|</span>
            <span>UPTIME: {formatUptime(summary.runtime_state.started_at)}</span>
          </div>
          <div className="flex items-center gap-5 nipux-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            <span>LOCATION: LOCAL_SECURE</span>
            <span>V2.4.0-STABLE</span>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
