"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./app-shell";
import { getInstallTask, installRuntime, saveSettings, startRuntime, stopRuntime } from "@/lib/api";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function panelLabel(label: string) {
  return (
    <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
      {label}
    </div>
  );
}

function modelLabel(model: {
  id: string;
  family: string;
  size: string;
  quantization: string;
}) {
  if (model.id === "custom") {
    return model.family === "Custom" ? "Custom model" : model.family;
  }
  return `${model.family} ${model.size} ${model.quantization}`;
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-[var(--border)] px-4 py-4">
      <div className="nipux-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-3 text-[28px] font-medium tracking-[-0.05em] text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

export function DashboardView() {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [runtimeChoice, setRuntimeChoice] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [customModelName, setCustomModelName] = useState("");
  const [customModelRepo, setCustomModelRepo] = useState("");
  const [customModelFilename, setCustomModelFilename] = useState("");
  const [customModelSizeGb, setCustomModelSizeGb] = useState("");
  const [setupHydrated, setSetupHydrated] = useState(false);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const modelOptions = useMemo(() => summary?.runtime_plan.model_options ?? [], [summary?.runtime_plan.model_options]);
  const runtimeOptions = useMemo(
    () => summary?.runtime_plan.runtime_options ?? [],
    [summary?.runtime_plan.runtime_options],
  );

  useEffect(() => {
    if (!summary || setupHydrated) {
      return;
    }
    setRuntimeChoice(
      summary.runtime_plan.runtime.id ||
        summary.settings.preferred_runtime_id ||
        runtimeOptions[0]?.id ||
        "",
    );
    setModelChoice(
      summary.settings.preferred_model_id ||
        summary.runtime_plan.recommendation.selected_model_id ||
        summary.runtime_plan.model?.id ||
        "",
    );
    setCustomModelName(summary.settings.custom_model_name || "");
    setCustomModelRepo(summary.settings.custom_model_repo || "");
    setCustomModelFilename(summary.settings.custom_model_filename || "");
    setCustomModelSizeGb(
      summary.settings.custom_model_size_gb
        ? String(summary.settings.custom_model_size_gb)
        : "",
    );
    setSetupHydrated(true);
  }, [runtimeOptions, setupHydrated, summary]);

  useEffect(() => {
    if (!summary?.runtime_state.install_task_id) {
      setInstallLogs((current) => (current.length ? [] : current));
      return;
    }
    let active = true;
    const taskId = summary.runtime_state.install_task_id;
    const timer = setInterval(() => {
      void getInstallTask(taskId)
        .then((task) => {
          if (!active) {
            return;
          }
          setInstallLogs(task.detail.logs ?? []);
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

  async function withPending<T>(key: string, task: () => Promise<T>) {
    setPendingAction(key);
    setActionError(null);
    try {
      return await task();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
      throw err;
    } finally {
      setPendingAction(null);
    }
  }

  function settingsPayload() {
    return {
      preferred_runtime_id: runtimeChoice,
      preferred_model_id: modelChoice,
      custom_model_enabled: modelChoice === "custom",
      custom_model_name: customModelName,
      custom_model_repo: customModelRepo,
      custom_model_filename: customModelFilename,
      custom_model_runtime: runtimeChoice || summary?.runtime_plan.runtime.id || "llama.cpp",
      custom_model_size_gb: Number(customModelSizeGb || 0),
    };
  }

  async function handleSave() {
    await withPending("save", async () => {
      await saveSettings(settingsPayload());
    });
    await refresh();
  }

  async function handleInstall() {
    await withPending("install", async () => {
      await saveSettings(settingsPayload());
      await installRuntime({
        runtime_id: runtimeChoice,
        model_id: modelChoice,
      });
    });
    await refresh();
  }

  async function handleRuntimeToggle() {
    if (!summary) {
      return;
    }
    await withPending("runtime", async () => {
      await saveSettings(settingsPayload());
      if (summary.runtime_state.model_loaded) {
        await stopRuntime();
      } else {
        await startRuntime({
          runtime_id: runtimeChoice,
          model_id: modelChoice,
        });
      }
    });
    await refresh();
  }

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          Booting Nipux...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          {error ?? "Dashboard unavailable."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="grid h-[calc(100vh-52px)] min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px]">
        <main className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-6">
            {panelLabel("dashboard")}
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[30px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
                  Runtime control
                </h1>
                <p className="mt-3 max-w-[640px] text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                  Choose a runtime, choose a model, install it through the backend, and
                  then move to Agents to assign actual work.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={summary.runtime_state.model_loaded ? "success" : "secondary"}>
                  {summary.runtime_state.model_loaded ? "runtime live" : "runtime stopped"}
                </Badge>
              </div>
            </div>
            {actionError ? (
              <p className="mt-4 text-[13px] leading-[1.6] text-[#d8a499]">{actionError}</p>
            ) : null}
          </header>

          <div className="grid gap-px bg-[var(--border)] md:grid-cols-2">
            <section className="bg-[var(--background)] px-5 py-5 md:px-6">
              {panelLabel("install")}
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Runtime
                  </label>
                  <select
                    value={runtimeChoice}
                    onChange={(event) => setRuntimeChoice(event.target.value)}
                    className="h-11 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--foreground)] outline-none"
                  >
                    {runtimeOptions.map((runtime) => (
                      <option key={runtime.id} value={runtime.id} className="bg-[var(--background)]">
                        {runtime.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Model
                  </label>
                  <select
                    value={modelChoice}
                    onChange={(event) => setModelChoice(event.target.value)}
                    className="h-11 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--foreground)] outline-none"
                  >
                    {modelOptions.map((model) => (
                      <option key={model.id} value={model.id} className="bg-[var(--background)]">
                        {modelLabel(model)}
                      </option>
                    ))}
                  </select>
                </div>

                {modelChoice === "custom" ? (
                  <>
                    <Input
                      value={customModelName}
                      onChange={(event) => setCustomModelName(event.target.value)}
                      placeholder="Custom model label"
                    />
                    <Input
                      value={customModelRepo}
                      onChange={(event) => setCustomModelRepo(event.target.value)}
                      placeholder="Hugging Face repo or file URL"
                    />
                    <Input
                      value={customModelFilename}
                      onChange={(event) => setCustomModelFilename(event.target.value)}
                      placeholder="Filename override (optional)"
                    />
                    <Input
                      value={customModelSizeGb}
                      onChange={(event) => setCustomModelSizeGb(event.target.value)}
                      placeholder="Approx size in GB"
                    />
                    <p className="text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                      Paste either a repo link like <span className="text-[var(--foreground)]">huggingface.co/org/model</span> or a direct file link like <span className="text-[var(--foreground)]">.../resolve/main/model.gguf</span>.
                    </p>
                  </>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void handleSave()} disabled={pendingAction === "save"}>
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleInstall()} disabled={pendingAction === "install"}>
                    Install
                  </Button>
                  <Button size="sm" onClick={() => void handleRuntimeToggle()} disabled={pendingAction === "runtime"}>
                    {summary.runtime_state.model_loaded ? "Stop runtime" : "Start runtime"}
                  </Button>
                </div>
              </div>
            </section>

            <section className="bg-[var(--background)] px-5 py-5 md:px-6">
              {panelLabel("recommended")}
              <div className="mt-4 space-y-4 text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
                <p>
                  Carnice is the recommended install path right now:
                </p>
                <div className="space-y-2">
                  <a
                    href="https://huggingface.co/kai-os/Carnice-9b-GGUF"
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[var(--foreground)]"
                  >
                    Carnice-9b-GGUF
                  </a>
                  <a
                    href="https://huggingface.co/kai-os/Carnice-27b-GGUF"
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[var(--foreground)]"
                  >
                    Carnice-27b-GGUF
                  </a>
                </div>
                <div className="nipux-mono text-[11px] uppercase tracking-[0.14em] text-[var(--foreground)]/84">
                  {summary.runtime_plan.install_plan.blocked ? "CURRENT PLAN BLOCKED" : "CURRENT PLAN SUPPORTED"}
                </div>
              </div>
            </section>
          </div>

          <section className="min-h-0 overflow-auto border-t border-[var(--border)] px-5 py-5 md:px-6">
            {panelLabel("system log")}
            <div className="mt-4 space-y-3 nipux-mono text-[12px] leading-[1.7] text-[var(--foreground)]/78">
              {(installLogs.length ? installLogs.slice(-8) : summary.log_lines.slice(-8)).map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
              {!installLogs.length && !summary.log_lines.length ? (
                <div className="text-[var(--muted-foreground)]">No log output yet.</div>
              ) : null}
            </div>
          </section>
        </main>

        <aside className="min-h-0 min-w-0 overflow-auto px-5 py-5 md:px-6">
          {panelLabel("status")}
          <div className="mt-4 grid gap-3">
            <Metric label="Agents" value={String(summary.agents.length)} />
            <Metric label="Total tokens" value={String(summary.usage_summary.total_tokens)} />
            <Metric label="Throughput" value={`${summary.telemetry.total_throughput_tps.toFixed(1)} tok/s`} />
          </div>

          <div className="mt-6 border border-[var(--border)] px-4 py-4">
            {panelLabel("runtime")}
            <div className="mt-4 space-y-3 text-[14px] leading-[1.7] text-[var(--muted-foreground)]">
              <div>Runtime: {summary.runtime_plan.runtime.label}</div>
              <div>Model: {summary.runtime_plan.model ? modelLabel(summary.runtime_plan.model) : "None"}</div>
              <div>Disk footprint: {summary.runtime_plan.install_plan.estimated_disk_needed_gb.toFixed(1)} GB</div>
            </div>
          </div>

          <div className="mt-6 border border-[var(--border)] px-4 py-4">
            {panelLabel("recent agents")}
            <div className="mt-4 space-y-3">
              {summary.agents.length ? (
                summary.agents.slice(0, 6).map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between gap-3">
                    <div className="text-[14px] text-[var(--foreground)]">{agent.name}</div>
                    <Badge variant={agent.status === "running" ? "success" : "secondary"}>
                      {agent.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  No agents yet. Go to Agents and create one after the runtime is configured.
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
