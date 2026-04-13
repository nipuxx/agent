"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "./app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSummary, loadModel, startNode, stopNode, unloadModel } from "@/lib/api";
import type { NipuxSummary, NodeSummary } from "@/lib/types";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value?: number | null) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2,
  }).format(value);
}

function NodePanel({
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
    <article className="nipux-panel grid min-h-[420px] grid-rows-[auto_1fr_auto]">
      <div className="flex items-start justify-between border-b border-[var(--border)] px-7 py-6">
        <div>
          <div className="nipux-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            Node_identifier
          </div>
          <div className="mt-3 nipux-display text-[58px] uppercase leading-[0.88]">
            {node.identifier}
          </div>
        </div>
        <Badge variant={active ? "default" : "secondary"}>{active ? "Active" : "Idle"}</Badge>
      </div>

      <div className="px-7 py-6">
        <div className="grid gap-5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <span className="nipux-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Model
            </span>
            <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">{node.model}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <span className="nipux-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Latency
            </span>
            <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">
              {node.latency_ms.toFixed(0)}MS
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <span className="nipux-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Tokens/sec
            </span>
            <span className="nipux-mono text-[13px] uppercase tracking-[0.12em]">
              {node.tokens_per_sec.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="mt-10 flex h-[128px] items-end gap-3">
          {node.trend.map((value, index) => (
            <div
              key={`${node.id}-${index}`}
              className={index % 3 === 2 ? "bg-white" : "bg-white/32"}
              style={{ height: `${value}px`, width: "20%" }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {node.label}
          </span>
          <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            T: {formatCount(node.total_tokens)}
          </span>
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-7 py-5">
        <Button variant={active ? "outline" : "default"} size="sm" onClick={onToggle} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? "Stop_node" : "Deploy_node"}
        </Button>
      </div>
    </article>
  );
}

function MetricBlock({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <div className="nipux-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-3 text-[62px] leading-none">{value}</div>
      {detail ? (
        <div className="mt-3 nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          {detail}
        </div>
      ) : null}
      <Separator className="mt-5" />
    </div>
  );
}

export function DashboardView() {
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
            Booting_nipux_surface
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
          System_status: {summary.hermes.installed && summary.settings.configured ? "Optimal" : "Config_required"}
        </div>

        <div className="mt-5 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-[980px]">
            <h1 className="nipux-display text-[132px] uppercase leading-[0.84] tracking-[0.02em]">
              Agent_Control
            </h1>
            <p className="mt-4 max-w-[780px] text-[32px] leading-[1.2] text-[var(--muted-foreground)]">
              Hermes-backed orchestration for local agent nodes. Nipux keeps Hermes isolated,
              reads its real session state, and controls the runtime around it.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="lg">
              <Link href="/settings">Open_settings</Link>
            </Button>
            <Button
              size="lg"
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
                "Unload_runtime"
              ) : (
                "Load_runtime"
              )}
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 border-t border-[var(--border)] pt-5 md:grid-cols-4">
          <div>
            <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              Active_model
            </div>
            <div className="mt-2 nipux-mono text-[14px] uppercase tracking-[0.12em]">
              {summary.runtime_state.active_model_id || summary.settings.model || "UNASSIGNED"}
            </div>
          </div>
          <div>
            <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              Endpoint
            </div>
            <div className="mt-2 nipux-mono text-[14px] uppercase tracking-[0.12em]">
              {summary.runtime_state.endpoint || summary.settings.openai_base_url || "NOT_SET"}
            </div>
          </div>
          <div>
            <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              Hermes
            </div>
            <div className="mt-2 nipux-mono text-[14px] uppercase tracking-[0.12em]">
              {summary.hermes.installed ? "INSTALLED" : "NOT_INSTALLED"} /{" "}
              {summary.hermes.gateway_running ? "GATEWAY_ONLINE" : "CLI_MODE"}
            </div>
          </div>
          <div>
            <div className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              Toolsets
            </div>
            <div className="mt-2 nipux-mono text-[14px] uppercase tracking-[0.12em]">
              {summary.settings.toolsets.length > 0
                ? summary.settings.toolsets.join(", ")
                : "UNASSIGNED"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid border-b border-[var(--border)] xl:grid-cols-4">
        {summary.nodes.map((node) => (
          <NodePanel
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

      <section className="grid xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="nipux-panel border-r-0 px-10 py-10 xl:border-r xl:border-[var(--border)]">
          <div className="flex items-center justify-between gap-4">
            <div className="nipux-mono text-[14px] uppercase tracking-[0.28em]">
              Terminal_log_output
            </div>
            <div className="nipux-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
              Hermes_runtime_bridge
            </div>
          </div>

          <div className="mt-8 min-h-[360px] space-y-4">
            {summary.log_lines.map((line) => (
              <div key={line} className="nipux-mono text-[15px] leading-8 text-[var(--foreground)]">
                {line}
              </div>
            ))}
            <div className="nipux-mono text-[28px] text-[var(--foreground)]">&gt; _</div>
          </div>
        </div>

        <div className="nipux-panel-soft px-10 py-10">
          <div className="nipux-mono text-[14px] uppercase tracking-[0.28em]">Cluster_metrics</div>

          <div className="mt-10 space-y-10">
            <MetricBlock
              label="Total throughput"
              value={`${summary.telemetry.total_throughput_tps.toFixed(1)}`}
              detail="TOK / SEC"
            />
            <MetricBlock
              label="Money saved"
              value={formatMoney(summary.usage_summary.savings_vs_api_usd)}
              detail="VS_QWEN_API_EQUIVALENT"
            />
            <MetricBlock
              label="Total tokens"
              value={formatCount(summary.usage_summary.total_tokens)}
              detail={`${formatCount(summary.usage_summary.requests)} REQUESTS / ${formatCount(summary.usage_summary.tool_calls)} TOOL_CALLS`}
            />
            <MetricBlock
              label="Nodes online"
              value={`${summary.telemetry.active_nodes}/${summary.telemetry.node_count}`}
              detail={`${summary.telemetry.active_sessions} ACTIVE_SESSIONS`}
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
