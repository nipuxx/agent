"use client";

import { useEffect, useState } from "react";
import { AppShell } from "./app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSummary } from "@/lib/api";
import { formatDeviceMeta } from "@/lib/planner";
import type { NipuxSummary } from "@/lib/types";

function formatMoney(value?: number | null) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2,
  }).format(value);
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="rounded-md bg-[var(--card-2)]">
      <CardContent className="p-5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          {label}
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <div className="mt-2 text-sm text-[var(--muted-foreground)]">{hint}</div> : null}
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
  const primaryGpu = summary.system.gpus[0];
  const apiReference = summary.api_reference;
  const localEstimate = summary.recommendation.estimated_cost_per_million_tokens_usd;
  const savings =
    apiReference?.blended_per_million_usd != null && localEstimate != null
      ? apiReference.blended_per_million_usd - localEstimate
      : null;

  return (
    <AppShell
      title="Dashboard"
      subtitle="Local hardware, recommended Carnice path, and live API reference pricing for the matching Qwen base model."
    >
      <div className="grid gap-3 xl:grid-cols-6">
        <MetricCard
          label="Local model"
          value={recommended ? `${recommended.family} ${recommended.size}` : "Unsupported"}
          hint={recommended ? `${recommended.quantization} · ${summary.runtime.label}` : summary.recommendation.reason}
        />
        <MetricCard
          label="Usable memory"
          value={`${summary.recommendation.effective_vram_gb.toFixed(0)} GB`}
          hint={summary.system.apple_silicon ? "Unified-memory budget" : "VRAM budget"}
        />
        <MetricCard
          label="Local speed"
          value={
            summary.recommendation.estimated_tokens_per_second != null
              ? `${summary.recommendation.estimated_tokens_per_second.toFixed(1)} t/s`
              : "--"
          }
          hint="Estimated local generation rate"
        />
        <MetricCard
          label="OpenRouter prompt"
          value={formatMoney(apiReference?.prompt_per_million_usd)}
          hint={apiReference ? `1M input tokens · ${apiReference.model_id}` : "Pricing unavailable"}
        />
        <MetricCard
          label="OpenRouter completion"
          value={formatMoney(apiReference?.completion_per_million_usd)}
          hint="1M output tokens"
        />
        <MetricCard
          label="API 1M in + 1M out"
          value={formatMoney(apiReference?.blended_per_million_usd)}
          hint={
            savings != null
              ? `${formatMoney(savings)} above the local power estimate`
              : "Prompt + completion reference cost"
          }
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-md">
          <CardHeader className="border-b border-[var(--border)] pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Machine</CardTitle>
              <Badge variant="secondary">{summary.system.hostname}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {summary.system.chip_name ?? summary.system.cpu_model}
              </div>
              <div className="text-sm text-[var(--muted-foreground)]">
                {summary.system.platform} {summary.system.release} · {summary.system.arch} · {summary.system.ram_gb} GB RAM
              </div>
            </div>

            {primaryGpu ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">{primaryGpu.name}</div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {formatDeviceMeta(primaryGpu)}
                  {primaryGpu.memory_bandwidth_gbps ? ` · ${primaryGpu.memory_bandwidth_gbps} GB/s` : ""}
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--muted-foreground)]">
                No accelerator detected yet.
              </div>
            )}

            <div className="space-y-1">
              <div className="text-sm font-medium">Hermes</div>
              <div className="text-sm text-[var(--muted-foreground)]">
                {summary.hermes.installed
                  ? `Installed at ${summary.hermes.binary}`
                  : "Not installed yet. Nipux will wire it later through the setup flow."}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="border-b border-[var(--border)] pb-4">
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {recommended
                  ? `Run ${recommended.family} ${recommended.size} ${recommended.quantization} through ${summary.runtime.label}.`
                  : "This machine does not currently fit a supported Carnice build."}
              </div>
              <div className="text-sm text-[var(--muted-foreground)]">
                Nipux has only planned the stack so far. Nothing is downloaded or installed until you confirm it in Configs.
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  First-time disk
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {summary.install_plan.estimated_disk_needed_gb.toFixed(1)} GB
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Base model reference
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {apiReference ? apiReference.label.replace("Qwen: ", "") : "Unavailable"}
                </div>
              </div>
            </div>

            {summary.install_plan.warnings.length ? (
              <div className="border-t border-[var(--border)] pt-4 text-sm text-[var(--muted-foreground)]">
                {summary.install_plan.warnings.join(" ")}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
