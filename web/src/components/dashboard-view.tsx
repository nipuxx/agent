"use client";

import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import { AppShell } from "./app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  info,
}: {
  label: string;
  value: string;
  hint?: string;
  info?: string;
}) {
  return (
    <Card className="rounded-md bg-[var(--card-2)]">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          <span>{label}</span>
          {info ? (
            <span title={info} className="inline-flex items-center">
              <CircleHelp className="h-3.5 w-3.5 normal-case tracking-normal" />
            </span>
          ) : null}
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <div className="mt-2 text-sm text-[var(--muted-foreground)]">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="text-sm text-[var(--muted-foreground)]">{label}</div>
      <div className="max-w-[70%] text-right text-sm text-[var(--foreground)]">{value}</div>
    </div>
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
  const costInfo = apiReference
    ? [
        `${apiReference.label} on OpenRouter`,
        `Prompt: ${formatMoney(apiReference.prompt_per_million_usd)} per 1M input tokens`,
        `Completion: ${formatMoney(apiReference.completion_per_million_usd)} per 1M output tokens`,
        `Combined here assumes 1M input + 1M output tokens`,
      ].join("\n")
    : "Pricing unavailable";

  return (
    <AppShell
      title="Dashboard"
      subtitle="Recommended local path and API-equivalent cost."
    >
      <div className="grid gap-3 xl:grid-cols-4">
        <MetricCard
          label="Local model"
          value={recommended ? `${recommended.family} ${recommended.size}` : "Unsupported"}
          hint={recommended ? `${recommended.quantization} · ${summary.runtime.label}` : summary.recommendation.reason}
        />
        <MetricCard
          label="Inference speed"
          value={
            summary.recommendation.estimated_tokens_per_second != null
              ? `${summary.recommendation.estimated_tokens_per_second.toFixed(1)} t/s`
              : "--"
          }
          hint="Estimated local generation rate"
        />
        <MetricCard
          label="API inference cost"
          value={formatMoney(apiReference?.blended_per_million_usd)}
          hint="Reference cost for the matching Qwen size on OpenRouter"
          info={costInfo}
        />
        <MetricCard
          label="Usable memory"
          value={`${summary.recommendation.effective_vram_gb.toFixed(0)} GB`}
          hint={summary.system.apple_silicon ? "Unified-memory budget" : "VRAM budget"}
        />
      </div>

      <Card className="mt-5 rounded-md">
        <CardContent className="p-5">
          <DetailRow
            label="Hardware"
            value={
              primaryGpu
                ? `${summary.system.chip_name ?? summary.system.cpu_model} · ${primaryGpu.name} · ${formatDeviceMeta(primaryGpu)}`
                : `${summary.system.chip_name ?? summary.system.cpu_model} · ${summary.system.ram_gb} GB RAM`
            }
          />
          <Separator />
          <DetailRow
            label="Recommended path"
            value={
              recommended
                ? `${recommended.family} ${recommended.size} ${recommended.quantization} through ${summary.runtime.label}`
                : "No supported Carnice build for this machine"
            }
          />
          <Separator />
          <DetailRow
            label="First-time download"
            value={`${summary.install_plan.estimated_disk_needed_gb.toFixed(1)} GB`}
          />
          {summary.install_plan.warnings.length ? (
            <>
              <Separator />
              <DetailRow label="Note" value={summary.install_plan.warnings.join(" ")} />
            </>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}
