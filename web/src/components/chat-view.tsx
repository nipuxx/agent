"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Cpu, Layers3, Wrench } from "lucide-react";
import { AppShell } from "./app-shell";
import { Panel } from "./panel";
import { getSummary } from "@/lib/api";
import type { NipuxSummary } from "@/lib/types";

export function ChatView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);

  useEffect(() => {
    getSummary().then(setSummary);
  }, []);

  const modelLabel = summary?.recommendation.selected
    ? `${summary.recommendation.selected.family} ${summary.recommendation.selected.size} ${summary.recommendation.selected.quantization}`
    : "No supported Carnice profile";

  return (
    <AppShell title="Chat Surface" kicker="Model and Hermes session design">
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <Panel title="Sessions" eyebrow="Recent">
          <div className="space-y-3">
            {["Hardware bring-up", "Browser search demo", "Repository repair pass"].map((label) => (
              <div key={label} className="rounded-xl border border-white/8 bg-black/10 px-4 py-3 text-sm text-[var(--dim)]">
                {label}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Conversation" eyebrow="Raw + Hermes modes">
          <div className="space-y-4">
            <div className="ml-auto max-w-[80%] rounded-2xl bg-[linear-gradient(135deg,rgba(255,158,69,0.24),rgba(90,200,255,0.2))] px-4 py-3 text-sm leading-7">
              Find the best Carnice build for this machine and explain why Nipux picked it.
            </div>
            <div className="max-w-[88%] rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-sm leading-7 text-[var(--dim)]">
              Nipux would route that request through the daemon, resolve the runtime and model plan,
              then decide whether this is a raw model chat or a Hermes-backed task session.
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <div className="mb-2 text-sm font-medium">Compose area</div>
              <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-[var(--dim)]">
                This first pass is focused on the product shell and backend contract. The actual
                streaming chat bridge belongs on top of `nipuxd`, not directly in the page.
              </div>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Selected Model" eyebrow="Planner output">
            <div className="space-y-3 text-sm text-[var(--dim)]">
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4 text-[var(--accent)]" />
                <span>{modelLabel}</span>
              </div>
              <div className="flex items-center gap-3">
                <Layers3 className="h-4 w-4 text-[var(--accent-2)]" />
                <span>{summary?.runtime.label ?? "Runtime loading"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Wrench className="h-4 w-4 text-[var(--ok)]" />
                <span>Hermes stays behind the Nipux adapter layer</span>
              </div>
            </div>
          </Panel>

          <Panel title="Main page metrics" eyebrow="Control plane">
            <div className="space-y-3 text-sm text-[var(--dim)]">
              <div>Effective local cost / 1M tokens</div>
              <div>Estimated tok/s</div>
              <div>Usable VRAM and bandwidth hints</div>
              <div>Install footprint and managed profile paths</div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-[var(--accent-2)]">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Keep these visible without turning the app into a benchmark graveyard.
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
