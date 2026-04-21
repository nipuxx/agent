"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "./app-shell";
import { useLiveSummary } from "@/lib/use-live-summary";
import { isSetupComplete } from "@/lib/setup";
import { Badge } from "@/components/ui/badge";

function panelLabel(label: string) {
  return (
    <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
      {label}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-[var(--border)] px-4 py-4">
      <div className="nipux-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-3 text-[24px] font-medium tracking-[-0.05em] text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

export function DashboardView() {
  const router = useRouter();
  const { summary, loading, error } = useLiveSummary();

  useEffect(() => {
    if (!summary || isSetupComplete(summary.settings)) {
      return;
    }
    router.replace("/setup");
  }, [router, summary]);

  const activeNodes = useMemo(
    () => (summary?.nodes ?? []).filter((node) => node.status === "active"),
    [summary?.nodes],
  );
  const activeRuns = useMemo(
    () => (summary?.runs ?? []).filter((run) => ["queued", "planning", "running", "paused"].includes(run.status)),
    [summary?.runs],
  );

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          Booting Nipux...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          {error ?? "Dashboard unavailable."}
        </div>
      </AppShell>
    );
  }

  if (!isSetupComplete(summary.settings)) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          Opening setup…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="grid h-[calc(100vh-52px)] min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-6">
            {panelLabel("dashboard")}
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[30px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
                  Local control surface
                </h1>
                <p className="mt-3 max-w-[760px] text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  Watch live token flow, active runs, and the agents currently working on this host.
                </p>
              </div>
              <Badge variant={summary.runtime_state.model_loaded ? "success" : "secondary"}>
                {summary.runtime_state.model_loaded ? "model live" : "runtime idle"}
              </Badge>
            </div>
          </header>

          <div className="grid gap-px bg-[var(--border)] md:grid-cols-3 xl:grid-cols-6">
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Active agents" value={String(activeNodes.length)} />
            </div>
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Running jobs" value={String(activeRuns.length)} />
            </div>
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Total tokens" value={String(summary.usage_summary.total_tokens)} />
            </div>
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Prompt tokens" value={String(summary.usage_summary.prompt_tokens)} />
            </div>
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Completion tokens" value={String(summary.usage_summary.completion_tokens)} />
            </div>
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Throughput" value={`${summary.telemetry.total_throughput_tps.toFixed(1)} tok/s`} />
            </div>
          </div>

          <div className="min-h-0 overflow-auto px-5 py-5 md:px-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="border border-[var(--border)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  {panelLabel("current agents")}
                  <Badge variant="secondary">{String(summary.agents.length)} total</Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {activeNodes.length ? (
                    activeNodes.map((node) => (
                      <div key={node.id} className="border border-[var(--border)] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[18px] font-medium tracking-[-0.04em] text-[var(--foreground)]">
                              {node.label}
                            </div>
                            <div className="mt-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                              {node.description || "No current task summary yet."}
                            </div>
                          </div>
                          <Badge variant="success">running</Badge>
                        </div>
                        <div className="mt-4 grid gap-3 text-[12px] text-[var(--muted-foreground)] md:grid-cols-3">
                          <div>Mode: {node.mode}</div>
                          <div>Speed: {node.tokens_per_sec.toFixed(1)} tok/s</div>
                          <div>Total: {node.total_tokens} tokens</div>
                        </div>
                      </div>
                    ))
                  ) : summary.agents.length ? (
                    summary.agents.map((agent) => (
                      <div key={agent.id} className="border border-[var(--border)] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[18px] font-medium tracking-[-0.04em] text-[var(--foreground)]">
                              {agent.name}
                            </div>
                            <div className="mt-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                              {agent.description || "No active task."}
                            </div>
                          </div>
                          <Badge variant="secondary">{agent.status}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                      No agents yet. Create one from Agents, then assign work from Chats.
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-5">
                <div className="border border-[var(--border)] px-4 py-4">
                  {panelLabel("runtime")}
                  <div className="mt-4 space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                    <div>Mode: {summary.settings.provider_mode === "external" ? "External endpoint" : "Local runtime"}</div>
                    <div>Runtime: {summary.runtime_state.runtime_id || summary.runtime_plan.runtime.label}</div>
                    <div>Model: {summary.runtime_state.active_model_id || summary.settings.openai_model || "None"}</div>
                    <div>Host RAM: {summary.telemetry.ram_used_gb.toFixed(1)} / {summary.telemetry.ram_total_gb.toFixed(1)} GB</div>
                  </div>
                </div>

                <div className="border border-[var(--border)] px-4 py-4">
                  {panelLabel("host")}
                  <div className="mt-4 space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                    <div>{summary.system.hostname}</div>
                    <div>{summary.system.platform}</div>
                    <div>{summary.system.gpus.length ? `${summary.system.gpus.length} GPU(s)` : "CPU only"}</div>
                    <div>Workspace: {summary.settings.workspace_root}</div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-auto px-5 py-5 md:px-6">
          <div className="border border-[var(--border)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              {panelLabel("system log")}
              <Badge variant="secondary">{String(summary.log_lines.length)} lines</Badge>
            </div>
            <div className="mt-4 space-y-3 nipux-mono text-[12px] leading-[1.8] text-[var(--foreground)]/78">
              {summary.log_lines.length ? (
                summary.log_lines.slice(-18).map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
              ) : (
                <div className="text-[var(--muted-foreground)]">No runtime activity yet.</div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
