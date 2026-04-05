"use client";

import { useEffect, useState } from "react";
import { Check, Download, Shield, Sparkles, Wrench } from "lucide-react";
import { AppShell } from "./app-shell";
import { Panel } from "./panel";
import { getSummary } from "@/lib/api";
import type { NipuxSummary } from "@/lib/types";

const STEPS = [
  {
    icon: Wrench,
    title: "Inspect the host",
    body: "Probe GPU vendor, usable VRAM, memory bandwidth hints, system RAM, and disk headroom before committing to a runtime or model.",
  },
  {
    icon: Sparkles,
    title: "Choose the runtime",
    body: "Prefer vLLM on strong NVIDIA boxes, fall back toward llama.cpp where compatibility matters more than raw throughput.",
  },
  {
    icon: Download,
    title: "Pin the Carnice build",
    body: "Choose the safest Carnice quantization for the detected hardware tier and warn before pulling anything that will not fit.",
  },
  {
    icon: Shield,
    title: "Isolate Hermes",
    body: "Keep Hermes in a Nipux-managed home/profile so frontend contracts survive upstream Hermes changes.",
  },
  {
    icon: Check,
    title: "Launch on the network",
    body: "Serve the UI and model endpoint cleanly on the local machine or LAN while keeping configuration under Nipux control.",
  },
];

export function SetupView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);

  useEffect(() => {
    getSummary().then(setSummary);
  }, []);

  return (
    <AppShell title="Setup Flow" kicker="Installer and launch choreography">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Why this flow exists" eyebrow="Product constraint">
          <div className="space-y-4 text-sm leading-7 text-[var(--dim)]">
            <p>
              Nipux is not just a model launcher. It has to choose the right runtime, warn before
              downloading the wrong quantization, and make Hermes feel native without welding the UI
              to Hermes internals.
            </p>
            <p>
              That is why the frontend talks to `nipuxd`, not directly to Hermes. The daemon owns the
              machine plan, and Hermes remains a replaceable downstream process.
            </p>
          </div>
        </Panel>

        <Panel title="Current plan for this machine" eyebrow="Resolved state">
          {summary ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="text-sm font-medium">Recommended runtime</div>
                <div className="mt-2 text-sm text-[var(--dim)]">{summary.runtime.label}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="text-sm font-medium">Recommended model</div>
                <div className="mt-2 text-sm text-[var(--dim)]">
                  {summary.recommendation.selected
                    ? `${summary.recommendation.selected.family} ${summary.recommendation.selected.size} ${summary.recommendation.selected.quantization}`
                    : "Unsupported"}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="text-sm font-medium">Hermes boundary</div>
                <div className="mt-2 text-sm text-[var(--dim)]">{summary.hermes.strategy}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="text-sm font-medium">Managed profile</div>
                <div className="mt-2 font-mono text-xs text-[var(--dim)]">{summary.hermes.managed_profile}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--dim)]">Loading plan...</div>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="nipux-panel rounded-2xl p-5">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/6">
                  <Icon className="h-5 w-5 text-[var(--accent-2)]" />
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.24em] text-[var(--dim)]">
                    Step {index + 1}
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--dim)]">{step.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

