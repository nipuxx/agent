"use client";

import { useEffect, useState } from "react";
import { Cpu, HardDrive, Layers3, Zap } from "lucide-react";
import { AppShell } from "./app-shell";
import { Panel } from "./panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSummary } from "@/lib/api";
import { formatDeviceMeta } from "@/lib/planner";
import type { NipuxSummary } from "@/lib/types";

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="bg-[var(--card-2)]">
      <CardContent className="p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          {label}
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
        <div className="mt-2 text-sm text-[var(--muted-foreground)]">{hint}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);

  useEffect(() => {
    getSummary().then(setSummary);
  }, []);

  if (!summary) {
    return (
      <AppShell title="Dashboard">
        <div className="text-sm text-[var(--muted-foreground)]">Loading Nipux…</div>
      </AppShell>
    );
  }

  const recommended = summary.recommendation.selected;

  return (
    <AppShell
      title="Dashboard"
      subtitle="Machine state, recommended stack, and install readiness. Nothing is installed until the setup flow is confirmed."
    >
      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="recommended model"
          value={recommended ? `${recommended.family} ${recommended.size}` : "Unsupported"}
          hint={recommended ? `${recommended.quantization} via ${summary.runtime.label}` : summary.recommendation.reason}
        />
        <MetricCard
          label="usable memory"
          value={`${summary.recommendation.effective_vram_gb.toFixed(0)} GB`}
          hint={summary.system.apple_silicon ? "Unified-memory budget" : "Usable VRAM budget"}
        />
        <MetricCard
          label="estimated throughput"
          value={
            summary.recommendation.estimated_tokens_per_second != null
              ? `${summary.recommendation.estimated_tokens_per_second.toFixed(1)}`
              : "--"
          }
          hint="Tokens / second estimate for the recommended path"
        />
        <MetricCard
          label="local cost"
          value={
            summary.recommendation.estimated_cost_per_million_tokens_usd != null
              ? `$${summary.recommendation.estimated_cost_per_million_tokens_usd.toFixed(2)}`
              : "--"
          }
          hint="Estimated effective cost per 1M output tokens"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Detected hardware"
          description="Nipux reads the host first, then recommends the lightest correct local path."
          right={<Badge variant="secondary">{summary.system.hostname}</Badge>}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cpu className="h-4 w-4 text-[var(--muted-foreground)]" />
                Host
              </div>
              <div className="mt-3 space-y-1 text-sm text-[var(--muted-foreground)]">
                <div>{summary.system.platform} {summary.system.release}</div>
                <div>{summary.system.arch}</div>
                <div>{summary.system.chip_name ?? summary.system.cpu_model}</div>
                <div>{summary.system.ram_gb} GB RAM</div>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Layers3 className="h-4 w-4 text-[var(--muted-foreground)]" />
                Accelerators
              </div>
              <div className="mt-3 space-y-3">
                {summary.system.gpus.map((gpu) => (
                  <div key={`${gpu.vendor}-${gpu.name}`} className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="text-sm font-medium">{gpu.name}</div>
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {formatDeviceMeta(gpu)}
                      {gpu.memory_bandwidth_gbps ? ` · ${gpu.memory_bandwidth_gbps} GB/s` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Install gate" description="Runtime and model downloads stay behind the setup wizard.">
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-[var(--muted-foreground)]" />
                Recommended runtime
              </div>
              <div className="mt-2 text-sm text-[var(--muted-foreground)]">{summary.runtime.reason}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4 text-[var(--muted-foreground)]" />
                Install footprint
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {summary.install_plan.estimated_disk_needed_gb.toFixed(1)} GB
              </div>
              <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                The daemon will not install the runtime or model until you confirm the plan in Configs.
              </div>
            </div>
            {summary.install_plan.warnings.length ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-4 text-sm text-[var(--muted-foreground)]">
                {summary.install_plan.warnings.join(" ")}
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

