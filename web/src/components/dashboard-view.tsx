"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
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
      <div className="mt-3 text-[28px] font-medium tracking-[-0.05em] text-[var(--foreground)]">{value}</div>
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
      <section className="grid h-[calc(100vh-52px)] min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-6">
            {panelLabel("dashboard")}
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[30px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
                  Runtime overview
                </h1>
                <p className="mt-3 max-w-[640px] text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  Check runtime health, recent system activity, and the agents currently attached to this host.
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/setup"
                  className="inline-flex h-10 items-center gap-2 border border-[var(--border)] px-4 text-[13px] text-[var(--foreground)] transition-colors hover:border-[var(--border-strong)]"
                >
                  Reconfigure
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/agents"
                  className="inline-flex h-10 items-center gap-2 border border-[var(--border)] px-4 text-[13px] text-[var(--foreground)] transition-colors hover:border-[var(--border-strong)]"
                >
                  Open agents
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </header>

          <div className="grid gap-px bg-[var(--border)] md:grid-cols-3">
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Agents" value={String(summary.agents.length)} />
            </div>
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Total tokens" value={String(summary.usage_summary.total_tokens)} />
            </div>
            <div className="bg-[var(--background)] px-5 py-5 md:px-6">
              <Stat label="Throughput" value={`${summary.telemetry.total_throughput_tps.toFixed(1)} tok/s`} />
            </div>
          </div>

          <div className="min-h-0 overflow-auto px-5 py-5 md:px-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="border border-[var(--border)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  {panelLabel("system log")}
                  <Badge variant={summary.runtime_state.model_loaded ? "success" : "secondary"}>
                    {summary.runtime_state.model_loaded ? "runtime live" : "runtime stopped"}
                  </Badge>
                </div>
                <div className="mt-4 space-y-3 nipux-mono text-[12px] leading-[1.8] text-[var(--foreground)]/78">
                  {summary.log_lines.length ? (
                    summary.log_lines.slice(-12).map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
                  ) : (
                    <div className="text-[var(--muted-foreground)]">No runtime activity yet.</div>
                  )}
                </div>
              </div>

              <aside className="space-y-5">
                <div className="border border-[var(--border)] px-4 py-4">
                  {panelLabel("runtime")}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-[14px] text-[var(--foreground)]">{summary.runtime_plan.runtime.label}</div>
                    <Badge variant={summary.runtime_state.model_loaded ? "success" : "secondary"}>
                      {summary.runtime_state.model_loaded ? "running" : summary.runtime_state.status}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                    <div>Endpoint: {summary.runtime_state.endpoint || "Not started"}</div>
                    <div>Model: {summary.runtime_state.active_model_id || summary.runtime_plan.model?.id || "None"}</div>
                    <div>Install state: {summary.runtime_state.runtime_installed ? "Ready" : "Missing"}</div>
                  </div>
                  {summary.runtime_state.last_error ? (
                    <div className="mt-4 border border-[var(--danger)]/45 px-4 py-4 text-[13px] leading-[1.7] text-[#d8a499]">
                      {summary.runtime_state.last_error}
                    </div>
                  ) : null}
                </div>

                <div className="border border-[var(--border)] px-4 py-4">
                  {panelLabel("agents")}
                  <div className="mt-4 space-y-3">
                    {summary.agents.length ? (
                      summary.agents.slice(0, 8).map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[14px] text-[var(--foreground)]">{agent.name}</div>
                            <div className="text-[12px] text-[var(--muted-foreground)]">
                              {agent.toolsets.join(", ")}
                            </div>
                          </div>
                          <Badge variant={agent.status === "running" ? "success" : "secondary"}>
                            {agent.status}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                        No agents yet. Create them from Agents.
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-auto px-5 py-5 md:px-6">
          {panelLabel("host")}
          <div className="mt-4 border border-[var(--border)] px-4 py-4">
            <div className="text-[14px] text-[var(--foreground)]">{summary.system.hostname}</div>
            <div className="mt-3 space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
              <div>Platform: {summary.system.platform}</div>
              <div>CPU: {summary.system.cpu_model}</div>
              <div>Memory: {summary.telemetry.ram_used_gb.toFixed(1)} / {summary.telemetry.ram_total_gb.toFixed(1)} GB</div>
              <div>GPU count: {summary.system.gpus.length}</div>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
