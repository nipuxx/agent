"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "./app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSummary, startAgent, stopAgent } from "@/lib/api";
import type { NipuxSummary } from "@/lib/types";

function AgentRow({
  label,
  description,
  mode,
  status,
  uptimeSeconds,
  pending,
  onStart,
  onStop,
}: {
  label: string;
  description: string;
  mode: string;
  status: string;
  uptimeSeconds: number;
  pending: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const running = status === "running";
  return (
    <div className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">{label}</div>
          <Badge variant={running ? "default" : "secondary"}>{running ? "Running" : "Stopped"}</Badge>
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{description}</div>
        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          {mode} {running ? `· ${uptimeSeconds}s uptime` : ""}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
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

export function AgentsView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  useEffect(() => {
    getSummary().then(setSummary);
  }, []);

  if (!summary) {
    return (
      <AppShell title="Agents">
        <div className="text-sm text-[var(--muted-foreground)]">Loading Nipux…</div>
      </AppShell>
    );
  }

  const runAction = (target: string, task: () => Promise<NipuxSummary>) => {
    setPendingTarget(target);
    void (async () => {
      const next = await task();
      setSummary(next);
      setPendingTarget(null);
    })();
  };

  return (
    <AppShell title="Agents" subtitle="Start and stop isolated Hermes-backed agent sessions.">
      <Card className="rounded-md">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center gap-3">
            <div className="text-sm font-medium">Runtime</div>
            <Badge variant={summary.runtime_state.model_loaded ? "default" : "secondary"}>
              {summary.runtime_state.model_loaded ? "Model loaded" : "Model not loaded"}
            </Badge>
          </div>
          <div className="text-sm text-[var(--muted-foreground)]">
            Starting any agent will keep the local model loaded and bring the agent up as its own managed session.
          </div>

          <Separator className="my-4" />

          {summary.agents.map((agent, index) => (
            <div key={agent.id}>
              <AgentRow
                label={agent.label}
                description={agent.description}
                mode={agent.mode}
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
    </AppShell>
  );
}
