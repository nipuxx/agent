"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./app-shell";
import { BrowserPane } from "./browser-pane";
import { createAgent, startAgent, stopAgent, updateAgent } from "@/lib/api";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";


function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="nipux-mono break-all text-[12px] uppercase tracking-[0.08em] text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}


export function AgentsView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [toolsets, setToolsets] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const agents = useMemo(() => summary?.agents ?? [], [summary?.agents]);
  const runs = useMemo(() => summary?.runs ?? [], [summary?.runs]);

  useEffect(() => {
    if (!selectedId && agents[0]) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null,
    [agents, selectedId],
  );

  useEffect(() => {
    if (!selectedAgent) return;
    setName(selectedAgent.name);
    setDescription(selectedAgent.description);
    setSystemPrompt(selectedAgent.system_prompt);
    setToolsets(selectedAgent.toolsets.join(", "));
  }, [selectedAgent]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.agent_id === selectedAgent?.id && ["queued", "planning", "running", "paused"].includes(run.status)) ?? null,
    [runs, selectedAgent?.id],
  );

  async function handleSave() {
    if (!selectedAgent) return;
    setPending(true);
    setActionError(null);
    try {
      await updateAgent(selectedAgent.id, {
        name,
        description,
        system_prompt: systemPrompt,
        toolsets: toolsets.split(",").map((item) => item.trim()).filter(Boolean),
      });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save agent.");
    } finally {
      setPending(false);
    }
  }

  async function handleCreate() {
    setPending(true);
    setActionError(null);
    try {
      const created = await createAgent({
        name: "New Agent",
        description: "Custom long-running Nipux worker.",
        system_prompt: "Work deliberately, verify progress, and checkpoint before claiming success.",
        toolsets: ["browser", "terminal", "file", "clarify"],
      });
      setSelectedId(created.id);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create agent.");
    } finally {
      setPending(false);
    }
  }

  async function handleToggle() {
    if (!selectedAgent) return;
    setPending(true);
    setActionError(null);
    try {
      if (selectedAgent.status === "running") {
        await stopAgent(selectedAgent.id);
      } else {
        await startAgent(selectedAgent.id);
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to change agent state.");
    } finally {
      setPending(false);
    }
  }

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center nipux-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Loading agents...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-6 text-[15px] text-[var(--muted-foreground)]">
          {error ?? "Agents are unavailable."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell telemetry={summary.telemetry}>
      <section className="grid min-h-[calc(100vh-52px)] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="border-r border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-5 py-5">
            <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              agents
            </div>
            <h1 className="mt-3 text-[42px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
              Agent fabric
            </h1>
            <div className="mt-4">
              <Button size="sm" onClick={() => void handleCreate()} disabled={pending}>
                Create agent
              </Button>
            </div>
          </div>

          <div className="px-3 py-3">
            {agents.map((agent) => {
              const active = agent.id === selectedAgent?.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedId(agent.id)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-[var(--border)] px-3 py-4 text-left transition-colors ${
                    active ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div>
                    <div className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      {agent.id}
                    </div>
                    <div className="mt-2 text-[22px] font-medium tracking-[-0.04em] text-[var(--foreground)]">
                      {agent.name}
                    </div>
                  </div>
                  <Badge variant={agent.status === "running" ? "success" : "secondary"}>{agent.status}</Badge>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="border-r border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-6 py-5 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  selected_agent
                </div>
                <h2 className="mt-3 text-[48px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
                  {selectedAgent?.name ?? "No agent"}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleSave()} disabled={pending || !selectedAgent}>
                  Save
                </Button>
                <Button size="sm" onClick={() => void handleToggle()} disabled={pending || !selectedAgent}>
                  {selectedAgent?.status === "running" ? "Stop agent" : "Start agent"}
                </Button>
              </div>
            </div>
            {actionError ? <p className="mt-4 text-[14px] text-[#d8a499]">{actionError}</p> : null}
          </div>

          <div className="grid gap-5 px-6 py-5 md:px-8">
            <div className="grid gap-2">
              <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Name
              </label>
              <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!selectedAgent} />
            </div>
            <div className="grid gap-2">
              <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Description
              </label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={!selectedAgent} />
            </div>
            <div className="grid gap-2">
              <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                System prompt
              </label>
              <Textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} disabled={!selectedAgent} className="min-h-[160px]" />
            </div>
            <div className="grid gap-2">
              <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Toolsets
              </label>
              <Input value={toolsets} onChange={(event) => setToolsets(event.target.value)} disabled={!selectedAgent} />
            </div>
            <BrowserPane agentId={selectedAgent?.id} title="browser" />
          </div>
        </main>

        <aside className="grid">
          <div className="border-b border-[var(--border)] px-5 py-5">
            <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              live_state
            </div>
            <div className="mt-4">
              <DetailRow label="Status" value={selectedAgent?.status?.toUpperCase() ?? "IDLE"} />
              <DetailRow label="Run" value={selectedRun?.status?.toUpperCase() ?? "IDLE"} />
              <DetailRow label="Runtime" value={summary.runtime_state.runtime_id?.toUpperCase() ?? "AUTO"} />
              <DetailRow label="Browser" value={selectedAgent ? "READY" : "UNBOUND"} />
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              policy
            </div>
            <div className="mt-4">
              <DetailRow label="Tools" value={(selectedAgent?.toolsets ?? []).join(",") || "NONE"} />
              <DetailRow label="Prompt" value={selectedAgent?.system_prompt ? "CUSTOM" : "DEFAULT"} />
              <DetailRow label="Workspace" value={summary.settings.workspace_root} />
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
