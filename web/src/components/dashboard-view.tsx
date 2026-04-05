"use client";

import { useEffect, useState } from "react";
import { HardDriveDownload, ServerCog, ShieldCheck, Zap } from "lucide-react";
import { AppShell } from "./app-shell";
import { Panel } from "./panel";
import { getSummary } from "@/lib/api";
import type { NipuxSummary } from "@/lib/types";

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="nipux-metric rounded-2xl p-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--dim)]">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-[var(--dim)]">{hint}</div>
    </div>
  );
}

export function DashboardView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);

  useEffect(() => {
    getSummary().then(setSummary);
  }, []);

  if (!summary) {
    return <div className="p-8 text-sm text-[var(--dim)]">Loading Nipux...</div>;
  }

  const selected = summary.recommendation.selected;
  const bandwidth = Math.max(
    ...summary.system.gpus.map((gpu) => gpu.memory_bandwidth_gbps ?? 0),
    0,
  );

  return (
    <AppShell title="Nipux Dashboard" kicker="Machine-first local agent stack">
      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="recommended model"
          value={selected ? `${selected.family} ${selected.size}` : "Unsupported"}
          hint={selected ? selected.quantization : "Needs more VRAM"}
        />
        <Metric
          label="runtime"
          value={summary.runtime.label}
          hint={summary.runtime.reason}
        />
        <Metric
          label="usable vram"
          value={`${summary.recommendation.effective_vram_gb.toFixed(0)} GB`}
          hint={`${summary.system.gpus.length || 0} GPU(s) detected`}
        />
        <Metric
          label="bandwidth hint"
          value={bandwidth > 0 ? `${bandwidth.toFixed(0)} GB/s` : "Unknown"}
          hint="Used to avoid overly aggressive model picks."
        />
        <Metric
          label="local cost"
          value={
            summary.recommendation.estimated_cost_per_million_tokens_usd != null
              ? `$${summary.recommendation.estimated_cost_per_million_tokens_usd.toFixed(2)}`
              : "--"
          }
          hint="Estimated effective cost per 1M generated tokens."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Host Snapshot"
          eyebrow="Detected Hardware"
          right={
            <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--dim)]">
              {summary.system.hostname}
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="text-sm font-medium">Platform</div>
                <div className="mt-2 text-sm text-[var(--dim)]">
                  {summary.system.platform} {summary.system.release} on {summary.system.arch}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="text-sm font-medium">CPU / RAM</div>
                <div className="mt-2 text-sm text-[var(--dim)]">
                  {summary.system.cpu_model}
                  <br />
                  {summary.system.cpu_cores_physical} physical / {summary.system.cpu_cores_logical} logical cores
                  <br />
                  {summary.system.ram_gb} GB RAM
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {summary.system.gpus.map((gpu) => (
                <div key={`${gpu.vendor}-${gpu.name}`} className="rounded-xl border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{gpu.name}</div>
                    <div className="text-xs text-[var(--dim)]">{gpu.vendor}</div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--dim)]">
                    {gpu.vram_gb.toFixed(1)} GB VRAM
                    {gpu.memory_bandwidth_gbps ? ` · ${gpu.memory_bandwidth_gbps.toFixed(0)} GB/s` : ""}
                    {gpu.driver ? ` · ${gpu.driver}` : ""}
                  </div>
                </div>
              ))}
              {summary.system.gpus.length === 0 ? (
                <div className="rounded-xl border border-[var(--err)]/30 bg-[var(--err)]/8 p-4 text-sm text-[var(--dim)]">
                  No supported discrete GPU was detected. Nipux will fall back toward compatibility planning.
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel title="Recommended Stack" eyebrow="Planner Output">
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--ok)]/30 bg-[var(--ok)]/8 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-[var(--ok)]" />
                Best fit right now
              </div>
              <div className="text-sm leading-6 text-[var(--dim)]">{summary.recommendation.reason}</div>
            </div>

            {selected ? (
              <div className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="text-sm font-medium">{selected.family} {selected.size}</div>
                <div className="mt-2 text-sm text-[var(--dim)]">
                  {selected.quantization} via {summary.runtime.label}
                  <br />
                  File: {selected.filename}
                  <br />
                  Repo: {selected.repo}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3">
              <div className="flex gap-3 rounded-xl border border-white/8 bg-black/10 p-4">
                <ServerCog className="mt-0.5 h-4 w-4 text-[var(--accent-2)]" />
                <div className="text-sm text-[var(--dim)]">
                  Runtime choice is decoupled from the UI. Nipux can swap `vLLM` and `llama.cpp`
                  without touching frontend state shape.
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-white/8 bg-black/10 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--ok)]" />
                <div className="text-sm text-[var(--dim)]">
                  Hermes is managed behind a process boundary with a Nipux-owned profile so upstream
                  Hermes updates do not become direct UI breakage.
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-white/8 bg-black/10 p-4">
                <HardDriveDownload className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
                <div className="text-sm text-[var(--dim)]">
                  Install footprint estimate: {summary.install_plan.estimated_disk_needed_gb} GB
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Install Plan" eyebrow="Boot Flow">
          <ol className="space-y-3">
            {summary.install_plan.steps.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold">
                  {index + 1}
                </div>
                <div className="text-sm leading-6 text-[var(--dim)]">{step}</div>
              </li>
            ))}
          </ol>
          {summary.install_plan.warnings.length ? (
            <div className="mt-4 rounded-xl border border-[var(--err)]/30 bg-[var(--err)]/8 p-4 text-sm text-[var(--dim)]">
              {summary.install_plan.warnings.join(" ")}
            </div>
          ) : null}
        </Panel>

        <Panel title="Model Ladder" eyebrow="Carnice Local Targets">
          <div className="grid gap-3 md:grid-cols-2">
            {summary.model_catalog.map((model) => (
              <div key={model.id} className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">
                    {model.family} {model.size}
                  </div>
                  <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--dim)]">
                    {model.quantization}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--dim)]">
                  Min VRAM {model.min_vram_gb} GB
                  <br />
                  Runtime {model.runtime}
                  <br />
                  {model.notes}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

