"use client";

import { useState } from "react";

import { AppShell } from "./app-shell";
import { startRuntime, stopRuntime } from "@/lib/api";
import { useLiveSummary } from "@/lib/use-live-summary";

function compactModelLabel(model: string) {
  const tail = model.split("/").pop() ?? model;
  return tail.replace("kai-os/", "").replace("-GGUF", "").replace(/_/g, "");
}

function displayNodeLabel(label: string) {
  return label
    .replace(" agent", "")
    .replace("Orchestrator", "Control")
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function formatLatency(value: number) {
  return value > 0 ? `${Math.round(value)}MS` : "0MS";
}

function formatRate(value: number) {
  return value > 0 ? value.toFixed(1) : "0.0";
}

function formatTokenTotal(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  return `${(value / 1_000).toFixed(1)}K`;
}

function TrendBars({ values }: { values: number[] }) {
  const peak = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-3">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="block w-10 bg-[var(--foreground)]/92"
          style={{ height: `${Math.max(18, (value / peak) * 68)}px`, opacity: 0.38 + index * 0.17 }}
        />
      ))}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center border-b border-[var(--border)] py-3 last:border-b-0">
      <span className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </span>
      <span className="nipux-mono text-[12px] uppercase tracking-[0.08em] text-[var(--foreground)]">
        {value}
      </span>
    </div>
  );
}

function NodeCard({
  identifier,
  label,
  status,
  model,
  latencyMs,
  tokensPerSec,
  totalTokens,
  trend,
}: {
  identifier: string;
  label: string;
  status: string;
  model: string;
  latencyMs: number;
  tokensPerSec: number;
  totalTokens: number;
  trend: number[];
}) {
  return (
    <article className="flex min-h-[292px] flex-col border-r border-b border-[var(--border)] px-5 py-5 md:px-6 md:py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          {identifier}
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 ${status === "active" ? "bg-white/88" : "bg-white/22"}`} />
          <span className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--foreground)]/82">
            {status}
          </span>
        </div>
      </div>

      <h3 className="mt-3 text-[30px] font-medium uppercase tracking-[-0.05em] text-[var(--foreground)] lg:text-[34px]">
        {label}
      </h3>

      <div className="mt-8">
        <StatRow label="Model" value={compactModelLabel(model)} />
        <StatRow label="Latency" value={formatLatency(latencyMs)} />
        <StatRow label="Tokens/Sec" value={formatRate(tokensPerSec)} />
      </div>

      <div className="mt-auto pt-8">
        <TrendBars values={trend} />
        <div className="mt-3 flex items-center justify-between">
          <span className="nipux-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            usage_trend
          </span>
          <span className="nipux-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            T: {formatTokenTotal(totalTokens)}
          </span>
        </div>
      </div>
    </article>
  );
}

function ClusterMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[52px] font-medium leading-none tracking-[-0.06em] text-[var(--foreground)]">
          {value}
        </span>
        {suffix ? (
          <span className="pb-1 nipux-mono text-[13px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {suffix}
          </span>
        ) : null}
      </div>
      <div className="h-px bg-[var(--border-strong)]" />
    </div>
  );
}

export function DashboardView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center nipux-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Booting Nipux control plane...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-6 text-center text-[15px] text-[var(--muted-foreground)]">
          {error ?? "Nipux summary is unavailable."}
        </div>
      </AppShell>
    );
  }

  const heroNodes = summary.nodes.slice(0, 3);
  const throughput = summary.telemetry.total_throughput_tps.toFixed(1);
  const totalTokens = formatTokenTotal(summary.usage_summary.total_tokens);
  const activeRuns = String(summary.runs.filter((run) => run.status === "running").length);

  async function handlePrimaryAction() {
    if (!summary) return;
    setActionPending(true);
    setActionError(null);
    try {
      if (summary.runtime_state.model_loaded) {
        await stopRuntime();
      } else {
        await startRuntime();
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Runtime action failed.");
    } finally {
      setActionPending(false);
    }
  }

  return (
    <AppShell telemetry={summary.telemetry}>
      <div className="flex min-h-[calc(100vh-52px)] flex-col overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.035),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_22%)]">
        <section className="grid border-b border-[var(--border)] xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="px-5 py-8 md:px-8 md:py-10">
            <div className="nipux-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
              SYSTEM STATUS: {summary.runtime_state.model_loaded ? "LIVE" : "READY"}
            </div>
            <h1 className="mt-6 max-w-[9ch] text-[clamp(56px,7vw,96px)] font-medium leading-[0.9] tracking-[-0.08em] text-[var(--foreground)]">
              AGENT_CONTROL
            </h1>
            <p className="mt-6 max-w-[640px] text-[17px] leading-[1.7] text-[var(--muted-foreground)] md:text-[18px]">
              Run long-horizon local agents through one clear control surface. Monitor
              throughput, tokens, and live system state without fighting the interface.
            </p>
            {actionError ? (
              <p className="mt-4 max-w-[720px] text-[14px] leading-[1.7] text-[#d8a499]">{actionError}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-end border-t border-[var(--border)] px-5 py-5 xl:border-l xl:border-t-0 xl:px-6">
            <button
              type="button"
              onClick={() => void handlePrimaryAction()}
              disabled={actionPending}
              className="h-[64px] w-full max-w-[208px] border border-[var(--foreground)] bg-[var(--foreground)] px-6 nipux-mono text-[13px] uppercase tracking-[0.16em] text-black transition-opacity hover:opacity-92"
            >
              {summary.runtime_state.model_loaded ? "STOP_RUNTIME" : actionPending ? "STARTING..." : "START_RUNTIME"}
            </button>
          </div>
        </section>

        <section className="grid xl:grid-cols-[repeat(3,minmax(0,1fr))]">
          {heroNodes.map((node) => (
            <NodeCard
              key={node.id}
              identifier={node.identifier}
              label={displayNodeLabel(node.label)}
              status={node.status}
              model={node.model}
              latencyMs={node.latency_ms}
              tokensPerSec={node.tokens_per_sec}
              totalTokens={node.total_tokens}
              trend={node.trend}
            />
          ))}
        </section>

        <section className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1.62fr)_340px]">
          <div className="border-r border-t border-[var(--border)] px-5 py-6 md:px-8 md:py-7">
            <div className="flex items-center justify-between gap-4">
              <div className="nipux-mono text-[12px] uppercase tracking-[0.22em] text-[var(--foreground)]/92">
                TERMINAL_LOG_OUTPUT
              </div>
            </div>

            <div className="mt-8 space-y-4 overflow-hidden nipux-mono text-[14px] leading-[1.8] text-[var(--foreground)]/88 md:text-[15px]">
              {summary.log_lines.map((line, index) => {
                const isWarn = line.includes("WARN");

                return (
                  <div key={`${line}-${index}`} className={isWarn ? "text-[#d8a499]" : undefined}>
                    {line}
                  </div>
                );
              })}
              <div>&gt; ■</div>
            </div>
          </div>

          <aside className="border-t border-[var(--border)] px-5 py-6 md:px-8 md:py-7">
            <div className="nipux-mono text-[12px] uppercase tracking-[0.22em] text-[var(--foreground)]/92">
              CLUSTER_METRICS
            </div>

            <div className="mt-10 space-y-9">
              <ClusterMetric label="Total Throughput" value={throughput} suffix="TOK/S" />
              <ClusterMetric label="Total Tokens" value={totalTokens} />
              <ClusterMetric label="Active Runs" value={activeRuns} />
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
