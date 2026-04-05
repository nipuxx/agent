"use client";

import { useEffect, useState } from "react";
import { CircleHelp, Loader2 } from "lucide-react";
import { AppShell } from "./app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSummary, loadModel, startAgent, stopAgent, unloadModel } from "@/lib/api";
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

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <div className="mt-2 text-sm text-[var(--muted-foreground)]">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function AgentQuickRow({
  label,
  status,
  uptimeSeconds,
  onStart,
  onStop,
  pending,
}: {
  label: string;
  status: string;
  uptimeSeconds: number;
  onStart: () => void;
  onStop: () => void;
  pending: boolean;
}) {
  const running = status === "running";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[var(--muted-foreground)]">
          {running ? `${uptimeSeconds}s uptime` : "Stopped"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={running ? "default" : "secondary"}>{running ? "Running" : "Stopped"}</Badge>
        {running ? (
          <Button variant="outline" size="sm" onClick={onStop} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Stop"}
          </Button>
        ) : (
          <Button size="sm" onClick={onStart} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function DashboardView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

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
  const runningAgents = summary.agents.filter((agent) => agent.status === "running").length;
  const usage = summary.usage_summary;
  const costInfo = summary.api_reference
    ? [
        `${summary.api_reference.label} on OpenRouter`,
        `Prompt: ${formatMoney(summary.api_reference.prompt_per_million_usd)} per 1M input tokens`,
        `Completion: ${formatMoney(summary.api_reference.completion_per_million_usd)} per 1M output tokens`,
        `Savings = API-equivalent spend minus the estimated local power cost across current prompt + completion totals`,
      ].join("\n")
    : "Pricing unavailable";

  const runAction = (target: string, task: () => Promise<NipuxSummary>) => {
    setPendingTarget(target);
    void (async () => {
      const next = await task();
      setSummary(next);
      setPendingTarget(null);
    })();
  };

  return (
    <AppShell title="Dashboard" subtitle="Runtime state, token totals, and active agents.">
      <div className="grid gap-3 xl:grid-cols-5">
        <MetricCard
          label="Model loaded"
          value={summary.runtime_state.model_loaded ? "Yes" : "No"}
          hint={
            summary.runtime_state.model_loaded && recommended
              ? `${recommended.family} ${recommended.size} ${recommended.quantization}`
              : "Load the recommended local model"
          }
        />
        <MetricCard
          label="Prompt tokens"
          value={formatCount(usage.prompt_tokens)}
          hint="All-time local input tokens"
        />
        <MetricCard
          label="Completion tokens"
          value={formatCount(usage.completion_tokens)}
          hint="All-time local output tokens"
        />
        <MetricCard
          label="Money saved"
          value={formatMoney(usage.savings_vs_api_usd)}
          hint="Compared with the matching Qwen OpenRouter reference"
          info={costInfo}
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
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">
                  {recommended
                    ? `${recommended.family} ${recommended.size} ${recommended.quantization} · ${summary.runtime.label}`
                    : "No supported Carnice build"}
                </div>
                <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {summary.runtime_state.model_loaded
                    ? `Serving on ${summary.runtime_state.endpoint}`
                    : "Model is not loaded yet"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={summary.runtime_state.model_loaded ? "default" : "secondary"}>
                  {summary.runtime_state.model_loaded ? "Loaded" : "Stopped"}
                </Badge>
                {summary.runtime_state.model_loaded ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingTarget !== null}
                    onClick={() => runAction("runtime", () => unloadModel())}
                  >
                    {pendingTarget === "runtime" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Unload"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={pendingTarget !== null || !recommended}
                    onClick={() => runAction("runtime", () => loadModel())}
                  >
                    {pendingTarget === "runtime" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load model"}
                  </Button>
                )}
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Total tokens
                </div>
                <div className="mt-2 text-xl font-semibold">{formatCount(usage.total_tokens)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Active agents
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {runningAgents} / {summary.agents.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardContent className="p-5">
            {summary.agents.map((agent, index) => (
              <div key={agent.id}>
                <AgentQuickRow
                  label={agent.label}
                  status={agent.status}
                  uptimeSeconds={agent.uptime_seconds}
                  pending={pendingTarget === agent.id}
                  onStart={() => runAction(agent.id, () => startAgent(agent.id))}
                  onStop={() => runAction(agent.id, () => stopAgent(agent.id))}
                />
                {index < summary.agents.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
