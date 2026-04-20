"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppShell } from "./app-shell";
import { RuntimeSetupPanel } from "./runtime-setup-panel";
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
      <div className="mt-3 text-[28px] font-medium tracking-[-0.05em] text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

export function DashboardView() {
  const router = useRouter();
  const { summary, loading, error, refresh } = useLiveSummary();

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
      <section className="grid h-[calc(100vh-52px)] min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-6">
            {panelLabel("dashboard")}
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[30px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
                  Runtime control
                </h1>
                <p className="mt-3 max-w-[640px] text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  Change the runtime, change the model, or install a different Hugging Face model link.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={summary.runtime_state.model_loaded ? "success" : "secondary"}>
                  {summary.runtime_state.model_loaded ? "runtime live" : "runtime stopped"}
                </Badge>
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

          <div className="min-h-0 overflow-auto">
            <RuntimeSetupPanel summary={summary} refresh={refresh} mode="dashboard" />
          </div>
        </main>

        <aside className="min-h-0 overflow-auto px-5 py-5 md:px-6">
          {panelLabel("system")}
          <div className="mt-4 border border-[var(--border)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px] text-[var(--foreground)]">Runtime</div>
              <Badge variant={summary.runtime_state.model_loaded ? "success" : "secondary"}>
                {summary.runtime_plan.runtime.label}
              </Badge>
            </div>
            <div className="mt-4 space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
              <div>Endpoint: {summary.runtime_state.endpoint || "Not started"}</div>
              <div>Installed model: {summary.runtime_state.active_model_id || "None"}</div>
            </div>
          </div>

          <div className="mt-6 border border-[var(--border)] px-4 py-4">
            {panelLabel("agents")}
            <div className="mt-4 space-y-3">
              {summary.agents.length ? (
                summary.agents.slice(0, 6).map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between gap-3">
                    <div className="text-[14px] text-[var(--foreground)]">{agent.name}</div>
                    <Badge variant={agent.status === "running" ? "success" : "secondary"}>
                      {agent.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  No agents yet. Create them in{" "}
                  <Link href="/agents" className="text-[var(--foreground)]">
                    Agents
                  </Link>
                  .
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
