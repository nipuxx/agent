"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./app-shell";
import { getInstallTask, installRuntime, saveSettings, startRuntime, stopRuntime } from "@/lib/api";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function panelLabel(label: string) {
  return (
    <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
      {label}
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
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState("120");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [browserHeadless, setBrowserHeadless] = useState(true);
  const [browserWidth, setBrowserWidth] = useState("1280");
  const [browserHeight, setBrowserHeight] = useState("800");
  const [allowTerminal, setAllowTerminal] = useState(true);
  const [allowBrowser, setAllowBrowser] = useState(true);
  const [allowFiles, setAllowFiles] = useState(true);
  const [customModelName, setCustomModelName] = useState("");
  const [customModelRepo, setCustomModelRepo] = useState("");
  const [customModelFilename, setCustomModelFilename] = useState("");
  const [customModelSizeGb, setCustomModelSizeGb] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [taskLogs, setTaskLogs] = useState<string[]>([]);

  const runtimeOptions = useMemo(() => summary?.runtime_plan.runtime_options ?? [], [summary?.runtime_plan.runtime_options]);
  const modelOptions = useMemo(() => summary?.runtime_plan.model_options ?? [], [summary?.runtime_plan.model_options]);

  useEffect(() => {
    if (!summary) return;
    setPreferredRuntime(summary.settings.preferred_runtime_id || summary.runtime_plan.runtime.id);
    setPreferredModel(summary.settings.preferred_model_id || summary.runtime_plan.recommendation.selected_model_id || "");
    setProviderMode(summary.settings.provider_mode);
    setEndpoint(summary.settings.openai_base_url);
    setApiKey(summary.settings.openai_api_key ?? "");
    setModelName(summary.settings.openai_model);
    setActionBudget(String(summary.settings.worker_action_budget));
    setCheckpointEvery(String(summary.settings.checkpoint_every_actions));
    setMaxRuntimeMinutes(String(summary.settings.max_runtime_minutes));
    setWorkspaceRoot(summary.settings.workspace_root);
    setBrowserHeadless(summary.settings.browser_headless);
    setBrowserWidth(String(summary.settings.browser_viewport?.width ?? 1280));
    setBrowserHeight(String(summary.settings.browser_viewport?.height ?? 800));
    setAllowTerminal(summary.settings.allow_terminal);
    setAllowBrowser(summary.settings.allow_browser);
    setAllowFiles(summary.settings.allow_file_tools);
    setCustomModelName(summary.settings.custom_model_name);
    setCustomModelRepo(summary.settings.custom_model_repo);
    setCustomModelFilename(summary.settings.custom_model_filename);
    setCustomModelSizeGb(summary.settings.custom_model_size_gb ? String(summary.settings.custom_model_size_gb) : "");
  }, [summary]);

  useEffect(() => {
    const taskId = summary?.runtime_state.install_task_id;
    if (!taskId) {
      setTaskLogs((current) => (current.length ? [] : current));
      return;
    }
    let active = true;
    const timer = setInterval(() => {
      void getInstallTask(taskId)
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

  async function persistSettings() {
    return saveSettings({
      provider_mode: providerMode,
      openai_base_url: endpoint,
      openai_api_key: apiKey,
      openai_model: modelName,
      preferred_runtime_id: providerMode === "local" ? preferredRuntime : "",
      preferred_model_id: providerMode === "local" ? preferredModel : "",
      custom_model_enabled: providerMode === "local" && preferredModel === "custom",
      custom_model_name: customModelName,
      custom_model_repo: customModelRepo,
      custom_model_filename: customModelFilename,
      custom_model_runtime: preferredRuntime,
      custom_model_size_gb: Number(customModelSizeGb || 0),
      worker_action_budget: Number(actionBudget),
      checkpoint_every_actions: Number(checkpointEvery),
      max_runtime_minutes: Number(maxRuntimeMinutes),
      browser_headless: browserHeadless,
      browser_viewport: {
        width: Number(browserWidth || 1280),
        height: Number(browserHeight || 800),
      },
      workspace_root: workspaceRoot,
      allow_terminal: allowTerminal,
      allow_browser: allowBrowser,
      allow_file_tools: allowFiles,
    });
  }

  async function handleSave() {
    setPending(true);
    setActionError(null);
    try {
      await persistSettings();
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
      await persistSettings();
      await installRuntime({
        runtime_id: preferredRuntime,
        model_id: preferredModel,
      });
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
      await persistSettings();
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
        <div className="flex min-h-screen items-center justify-center nipux-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Loading settings...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center px-6 text-[15px] text-[var(--muted-foreground)]">
          {error ?? "Settings are unavailable."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="grid h-screen min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-h-0 overflow-auto border-r border-[var(--border)] px-5 py-5 md:px-6">
          <header className="border border-[var(--border)] px-5 py-5">
            {panelLabel("settings")}
            <div className="mt-3 text-[30px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
              Runtime and agent defaults
            </div>
            {actionError ? <p className="mt-4 text-[14px] text-[#d8a499]">{actionError}</p> : null}
          </header>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="border border-[var(--border)] px-4 py-4">
              {panelLabel("provider")}
              <div className="mt-4 grid gap-4">
                <select
                  value={providerMode}
                  onChange={(event) => setProviderMode(event.target.value)}
                  className="h-11 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--foreground)] outline-none"
                >
                  <option value="local" className="bg-[var(--background)]">Local runtime</option>
                  <option value="external" className="bg-[var(--background)]">External endpoint</option>
                </select>
                {providerMode === "external" ? (
                  <>
                    <Input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="OpenAI-compatible endpoint" />
                    <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="API key" />
                    <Input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="External model name" />
                  </>
                ) : (
                  <div className="text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                    Local mode installs and serves the selected runtime on this machine.
                  </div>
                )}
              </div>
            </section>

            <section className="border border-[var(--border)] px-4 py-4">
              {panelLabel("runtime")}
              <div className="mt-4 grid gap-4">
                <select
                  value={preferredRuntime}
                  onChange={(event) => setPreferredRuntime(event.target.value)}
                  className="h-11 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--foreground)] outline-none"
                >
                  {runtimeOptions.map((item) => (
                    <option key={item.id} value={item.id} className="bg-[var(--background)]">
                      {item.label}
                    </option>
                  ))}
                </select>
                {providerMode === "local" ? (
                  <select
                    value={preferredModel}
                    onChange={(event) => setPreferredModel(event.target.value)}
                    className="h-11 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--foreground)] outline-none"
                  >
                    {modelOptions.map((item) => (
                      <option key={item.id} value={item.id} className="bg-[var(--background)]">
                        {item.family} {item.size} {item.quantization}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </section>

            {providerMode === "local" ? (
              <section className="border border-[var(--border)] px-4 py-4 xl:col-span-2">
              {panelLabel("custom model")}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input value={customModelName} onChange={(event) => setCustomModelName(event.target.value)} placeholder="Label" />
                <Input value={customModelRepo} onChange={(event) => setCustomModelRepo(event.target.value)} placeholder="Hugging Face repo or file URL" />
                <Input value={customModelFilename} onChange={(event) => setCustomModelFilename(event.target.value)} placeholder="Filename override (optional)" />
                <Input value={customModelSizeGb} onChange={(event) => setCustomModelSizeGb(event.target.value)} placeholder="Approx size in GB" />
              </div>
              <div className="mt-3 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                Carnice stays recommended, but you can point Nipux at any Hugging Face repo or direct file URL here.
              </div>
              </section>
            ) : null}

            <section className="border border-[var(--border)] px-4 py-4">
              {panelLabel("browser")}
              <div className="mt-4 grid gap-4">
                <label className="flex items-center gap-3 text-[14px] text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={browserHeadless}
                    onChange={(event) => setBrowserHeadless(event.target.checked)}
                    className="h-4 w-4 rounded-none border border-[var(--border)] bg-transparent"
                  />
                  <span>Run headless</span>
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={browserWidth} onChange={(event) => setBrowserWidth(event.target.value)} placeholder="Viewport width" />
                  <Input value={browserHeight} onChange={(event) => setBrowserHeight(event.target.value)} placeholder="Viewport height" />
                </div>
              </div>
            </section>

            <section className="border border-[var(--border)] px-4 py-4">
              {panelLabel("limits")}
              <div className="mt-4 grid gap-4">
                <Input value={actionBudget} onChange={(event) => setActionBudget(event.target.value)} placeholder="Worker action budget" />
                <Input value={checkpointEvery} onChange={(event) => setCheckpointEvery(event.target.value)} placeholder="Checkpoint cadence" />
                <Input value={maxRuntimeMinutes} onChange={(event) => setMaxRuntimeMinutes(event.target.value)} placeholder="Max runtime minutes" />
              </div>
            </section>

            <section className="border border-[var(--border)] px-4 py-4 xl:col-span-2">
              {panelLabel("workspace")}
              <div className="mt-4 grid gap-4">
                <Input value={workspaceRoot} onChange={(event) => setWorkspaceRoot(event.target.value)} placeholder="Workspace root" />
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex items-center gap-3 text-[14px] text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={allowTerminal}
                      onChange={(event) => setAllowTerminal(event.target.checked)}
                      className="h-4 w-4 rounded-none border border-[var(--border)] bg-transparent"
                    />
                    <span>Terminal</span>
                  </label>
                  <label className="flex items-center gap-3 text-[14px] text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={allowBrowser}
                      onChange={(event) => setAllowBrowser(event.target.checked)}
                      className="h-4 w-4 rounded-none border border-[var(--border)] bg-transparent"
                    />
                    <span>Browser</span>
                  </label>
                  <label className="flex items-center gap-3 text-[14px] text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={allowFiles}
                      onChange={(event) => setAllowFiles(event.target.checked)}
                      className="h-4 w-4 rounded-none border border-[var(--border)] bg-transparent"
                    />
                    <span>Files</span>
                  </label>
                </div>
              </div>
            </section>
          </div>
        </main>

        <aside className="min-h-0 overflow-auto px-5 py-5 md:px-6">
          <div className="border border-[var(--border)] px-4 py-4">
            {panelLabel("actions")}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void handleSave()} disabled={pending}>
                Save
              </Button>
              {providerMode === "local" ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => void handleInstall()} disabled={pending}>
                    Install
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleRuntimeToggle()} disabled={pending}>
                    {summary.runtime_state.model_loaded ? "Stop runtime" : "Start runtime"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-5 border border-[var(--border)] px-4 py-4">
            {panelLabel("status")}
            <div className="mt-4 space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
              <div>Setup: {summary.settings.setup_completed ? "complete" : "incomplete"}</div>
              <div>Runtime: {summary.runtime_state.runtime_id || "none"}</div>
              <div>Model: {summary.runtime_state.active_model_id || "none"}</div>
              <div>Endpoint: {summary.runtime_state.endpoint || summary.settings.openai_base_url || "none"}</div>
              <div>Host RAM: {summary.telemetry.ram_used_gb.toFixed(1)} / {summary.telemetry.ram_total_gb.toFixed(1)} GB</div>
            </div>
          </div>

          <div className="mt-5 border border-[var(--border)] px-4 py-4">
            {panelLabel("install log")}
            <div className="mt-4 space-y-3 nipux-mono text-[12px] leading-[1.7] text-[var(--foreground)]/84">
              {taskLogs.length ? taskLogs.slice(-16).map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : <div>No active install task.</div>}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
