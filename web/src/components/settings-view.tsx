"use client";

import { useEffect, useState } from "react";

import { AppShell } from "./app-shell";
import { getInstallTask, installRuntime, saveSettings, startRuntime, stopRuntime } from "@/lib/api";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


function StatusRow({ label, value }: { label: string; value: string }) {
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


export function SettingsView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [preferredRuntime, setPreferredRuntime] = useState("");
  const [preferredModel, setPreferredModel] = useState("");
  const [providerMode, setProviderMode] = useState("local");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [actionBudget, setActionBudget] = useState("8");
  const [checkpointEvery, setCheckpointEvery] = useState("3");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [taskLogs, setTaskLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!summary) return;
    setPreferredRuntime(summary.runtime_plan.runtime.id);
    setPreferredModel(summary.runtime_plan.recommendation.selected_model_id ?? "");
    setProviderMode(summary.settings.provider_mode);
    setEndpoint(summary.settings.openai_base_url);
    setApiKey(summary.settings.openai_api_key ?? "");
    setModelName(summary.settings.openai_model);
    setActionBudget(String(summary.settings.worker_action_budget));
    setCheckpointEvery(String(summary.settings.checkpoint_every_actions));
    setWorkspaceRoot(summary.settings.workspace_root);
  }, [summary]);

  useEffect(() => {
    if (!summary?.runtime_state.install_task_id) return;
    let active = true;
    const id = summary.runtime_state.install_task_id;
    const timer = setInterval(() => {
      void getInstallTask(id)
        .then((task) => {
          if (!active) return;
          setTaskLogs(task.detail.logs ?? []);
          if (task.status === "completed" || task.status === "failed") {
            void refresh();
          }
        })
        .catch(() => {});
    }, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh, summary?.runtime_state.install_task_id]);

  async function handleSave() {
    setPending(true);
    setActionError(null);
    try {
      await saveSettings({
        provider_mode: providerMode,
        openai_base_url: endpoint,
        openai_api_key: apiKey,
        openai_model: modelName,
        worker_action_budget: Number(actionBudget),
        checkpoint_every_actions: Number(checkpointEvery),
        workspace_root: workspaceRoot,
        preferred_runtime_id: preferredRuntime,
        preferred_model_id: preferredModel,
      });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setPending(false);
    }
  }

  async function handleInstall() {
    setPending(true);
    setActionError(null);
    try {
      const task = await installRuntime({
        runtime_id: preferredRuntime,
        model_id: preferredModel,
      });
      setTaskLogs(task.detail.logs ?? []);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to launch install.");
    } finally {
      setPending(false);
    }
  }

  async function handleRuntimeToggle() {
    if (!summary) return;
    setPending(true);
    setActionError(null);
    try {
      if (summary.runtime_state.model_loaded) {
        await stopRuntime();
      } else {
        await startRuntime({
          runtime_id: preferredRuntime,
          model_id: preferredModel,
        });
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to change runtime state.");
    } finally {
      setPending(false);
    }
  }

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center nipux-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Loading settings...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-6 text-[15px] text-[var(--muted-foreground)]">
          {error ?? "Settings are unavailable."}
        </div>
      </AppShell>
    );
  }

  const runtimeOptions = summary.runtime_plan.runtime_options ?? [];
  const modelOptions = summary.runtime_plan.model_options ?? [];
  const model = summary.runtime_plan.model;

  return (
    <AppShell telemetry={summary.telemetry}>
      <section className="grid min-h-[calc(100vh-52px)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-8">
            <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              settings
            </div>
            <h1 className="mt-3 text-[42px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
              Runtime boundary
            </h1>
            {actionError ? <p className="mt-4 text-[14px] text-[#d8a499]">{actionError}</p> : null}
          </header>

          <div className="grid gap-px bg-[var(--border)] lg:grid-cols-2">
            <section className="bg-[var(--background)] px-5 py-5 md:px-8">
              <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                runtime_plan
              </div>
              <div className="mt-4">
                <StatusRow label="Runtime" value={summary.runtime_plan.runtime.label} />
                <StatusRow label="Model" value={model ? `${model.family} ${model.size} ${model.quantization}` : "UNSUPPORTED"} />
                <StatusRow label="Disk" value={`${summary.runtime_plan.install_plan.estimated_disk_needed_gb.toFixed(1)} GB`} />
                <StatusRow label="Fit" value={summary.runtime_plan.install_plan.blocked ? "BLOCKED" : "SUPPORTED"} />
              </div>
            </section>

            <section className="bg-[var(--background)] px-5 py-5 md:px-8">
              <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                provider
              </div>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Mode
                  </label>
                  <select
                    value={providerMode}
                    onChange={(event) => setProviderMode(event.target.value)}
                    className="border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] text-[var(--foreground)] outline-none"
                  >
                    <option value="local" className="bg-[var(--background)]">
                      Local runtime
                    </option>
                    <option value="external" className="bg-[var(--background)]">
                      External endpoint
                    </option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Endpoint
                  </label>
                  <Input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="http://127.0.0.1:8000/v1" />
                </div>
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    API key
                  </label>
                  <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Optional for local runtimes" />
                </div>
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Model name
                  </label>
                  <Input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="qwen/qwen3.5-32b or local alias" />
                </div>
              </div>
            </section>

            <section className="bg-[var(--background)] px-5 py-5 md:px-8">
              <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                runtime_selection
              </div>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Preferred runtime
                  </label>
                  <select
                    value={preferredRuntime}
                    onChange={(event) => setPreferredRuntime(event.target.value)}
                    className="border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] text-[var(--foreground)] outline-none"
                  >
                    {runtimeOptions.map((item) => (
                      <option key={item.id} value={item.id} className="bg-[var(--background)]">
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Preferred model
                  </label>
                  <select
                    value={preferredModel}
                    onChange={(event) => setPreferredModel(event.target.value)}
                    className="border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] text-[var(--foreground)] outline-none"
                  >
                    {modelOptions.map((item) => (
                      <option key={item.id} value={item.id} className="bg-[var(--background)]">
                        {item.family} {item.size} {item.quantization}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="bg-[var(--background)] px-5 py-5 md:px-8">
              <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                harness_defaults
              </div>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Action budget
                  </label>
                  <Input value={actionBudget} onChange={(event) => setActionBudget(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Checkpoint cadence
                  </label>
                  <Input value={checkpointEvery} onChange={(event) => setCheckpointEvery(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Workspace root
                  </label>
                  <Input value={workspaceRoot} onChange={(event) => setWorkspaceRoot(event.target.value)} />
                </div>
              </div>
            </section>
          </div>
        </main>

        <aside className="grid">
          <div className="border-b border-[var(--border)] px-5 py-5">
            <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              actions
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void handleSave()} disabled={pending}>
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleInstall()} disabled={pending}>
                Install plan
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleRuntimeToggle()} disabled={pending}>
                {summary.runtime_state.model_loaded ? "Stop runtime" : "Start runtime"}
              </Button>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="nipux-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              task_log
            </div>
            <div className="mt-4 space-y-3 nipux-mono text-[12px] leading-[1.7] text-[var(--foreground)]/84">
              {taskLogs.length ? taskLogs.slice(-12).map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : <div>No active install task.</div>}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
