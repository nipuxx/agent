"use client";

import { useEffect, useMemo, useState } from "react";

import { getInstallTask, installRuntime, saveSettings, startRuntime, stopRuntime } from "@/lib/api";
import type { NipuxSummary, SettingsUpdate } from "@/lib/types";
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

function CheckboxRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-[14px] text-[var(--foreground)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded-none border border-[var(--border)] bg-transparent"
      />
      <span>{label}</span>
    </label>
  );
}

export function RuntimeSetupPanel({
  summary,
  refresh,
  mode = "dashboard",
  onComplete,
}: {
  summary: NipuxSummary;
  refresh: () => Promise<NipuxSummary>;
  mode?: "setup" | "dashboard";
  onComplete?: () => void;
}) {
  const [runtimeChoice, setRuntimeChoice] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [providerMode, setProviderMode] = useState("local");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [browserHeadless, setBrowserHeadless] = useState(true);
  const [customModelName, setCustomModelName] = useState("");
  const [customModelRepo, setCustomModelRepo] = useState("");
  const [customModelFilename, setCustomModelFilename] = useState("");
  const [customModelSizeGb, setCustomModelSizeGb] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [hydratedKey, setHydratedKey] = useState("");

  const runtimeOptions = useMemo(
    () => summary.runtime_plan.runtime_options ?? [],
    [summary.runtime_plan.runtime_options],
  );
  const modelOptions = useMemo(
    () => summary.runtime_plan.model_options ?? [],
    [summary.runtime_plan.model_options],
  );

  const summaryKey = JSON.stringify({
    preferred_runtime_id: summary.settings.preferred_runtime_id,
    preferred_model_id: summary.settings.preferred_model_id,
    custom_model_enabled: summary.settings.custom_model_enabled,
    custom_model_name: summary.settings.custom_model_name,
    custom_model_repo: summary.settings.custom_model_repo,
    custom_model_filename: summary.settings.custom_model_filename,
    custom_model_size_gb: summary.settings.custom_model_size_gb,
    provider_mode: summary.settings.provider_mode,
    openai_base_url: summary.settings.openai_base_url,
    openai_api_key: summary.settings.openai_api_key,
    openai_model: summary.settings.openai_model,
    workspace_root: summary.settings.workspace_root,
    browser_headless: summary.settings.browser_headless,
    runtime_id: summary.runtime_plan.runtime.id,
    recommended_model_id: summary.runtime_plan.recommendation.selected_model_id,
    model_id: summary.runtime_plan.model?.id,
  });

  useEffect(() => {
    if (hydratedKey === summaryKey) {
      return;
    }
    setRuntimeChoice(
      summary.settings.preferred_runtime_id ||
        summary.runtime_plan.runtime.id ||
        runtimeOptions[0]?.id ||
        "",
    );
    setModelChoice(
      summary.settings.preferred_model_id ||
        summary.runtime_plan.recommendation.selected_model_id ||
        summary.runtime_plan.model?.id ||
        "",
    );
    setProviderMode(summary.settings.provider_mode || "local");
    setEndpoint(summary.settings.openai_base_url || "");
    setApiKey(summary.settings.openai_api_key || "");
    setModelName(summary.settings.openai_model || "");
    setWorkspaceRoot(summary.settings.workspace_root || "");
    setBrowserHeadless(summary.settings.browser_headless);
    setCustomModelName(summary.settings.custom_model_name || "");
    setCustomModelRepo(summary.settings.custom_model_repo || "");
    setCustomModelFilename(summary.settings.custom_model_filename || "");
    setCustomModelSizeGb(
      summary.settings.custom_model_size_gb ? String(summary.settings.custom_model_size_gb) : "",
    );
    setHydratedKey(summaryKey);
  }, [hydratedKey, runtimeOptions, summary, summaryKey]);

  useEffect(() => {
    const taskId = summary.runtime_state.install_task_id;
    if (!taskId) {
      setInstallLogs((current) => (current.length ? [] : current));
      return;
    }
    let active = true;
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
  }, [refresh, summary.runtime_state.install_task_id]);

  function validate(): string | null {
    if (providerMode === "external") {
      if (!endpoint.trim()) {
        return "External mode requires an endpoint.";
      }
      if (!modelName.trim()) {
        return "External mode requires a model name.";
      }
      return null;
    }

    if (!runtimeChoice.trim()) {
      return "Choose a runtime.";
    }
    if (!modelChoice.trim()) {
      return "Choose a model.";
    }
    if (modelChoice === "custom" && !customModelRepo.trim()) {
      return "Custom model installs require a Hugging Face repo or file link.";
    }
    return null;
  }

  function settingsPayload(markSetupComplete = false): SettingsUpdate {
    return {
      setup_completed: summary.settings.setup_completed || markSetupComplete,
      provider_mode: providerMode,
      openai_base_url: endpoint.trim(),
      openai_api_key: apiKey.trim(),
      openai_model: modelName.trim(),
      preferred_runtime_id: providerMode === "local" ? runtimeChoice : "",
      preferred_model_id: providerMode === "local" ? modelChoice : "",
      custom_model_enabled: providerMode === "local" && modelChoice === "custom",
      custom_model_name: customModelName.trim(),
      custom_model_repo: customModelRepo.trim(),
      custom_model_filename: customModelFilename.trim(),
      custom_model_runtime: runtimeChoice || summary.runtime_plan.runtime.id || "llama.cpp",
      custom_model_size_gb: Number(customModelSizeGb || 0),
      workspace_root: workspaceRoot.trim(),
      browser_headless: browserHeadless,
    };
  }

  async function withPending<T>(key: string, task: () => Promise<T>) {
    const problem = validate();
    if (problem) {
      setActionError(problem);
      throw new Error(problem);
    }
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

  async function handleSave(markSetupComplete = false) {
    await withPending("save", async () => {
      await saveSettings(settingsPayload(markSetupComplete));
    });
    await refresh();
  }

  async function handleInstall() {
    if (providerMode !== "local") {
      return;
    }
    await withPending("install", async () => {
      await saveSettings(settingsPayload(true));
      await installRuntime({
        runtime_id: runtimeChoice,
        model_id: modelChoice,
      });
    });
    await refresh();
  }

  async function handleRuntimeToggle() {
    if (providerMode !== "local") {
      return;
    }
    await withPending("runtime", async () => {
      await saveSettings(settingsPayload(true));
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

  async function handleContinue() {
    await handleSave(true);
    onComplete?.();
  }

  return (
    <div className="grid h-full min-h-0 min-w-0 gap-px bg-[var(--border)] lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-h-0 bg-[var(--background)]">
        <div className="grid gap-px bg-[var(--border)] md:grid-cols-2">
          <div className="bg-[var(--background)] px-5 py-5 md:px-6">
            {panelLabel("provider")}
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <label className="nipux-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Mode
                </label>
                <select
                  value={providerMode}
                  onChange={(event) => setProviderMode(event.target.value)}
                  className="h-11 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--foreground)] outline-none"
                >
                  <option value="local" className="bg-[var(--background)]">
                    Local runtime
                  </option>
                  <option value="external" className="bg-[var(--background)]">
                    External endpoint
                  </option>
                </select>
              </div>

              {providerMode === "external" ? (
                <>
                  <Input
                    value={endpoint}
                    onChange={(event) => setEndpoint(event.target.value)}
                    placeholder="OpenAI-compatible endpoint"
                  />
                  <Input
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    placeholder="Model name"
                  />
                  <Input
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="API key (optional)"
                  />
                </>
              ) : (
                <>
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
                    <div className="grid gap-3">
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
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="bg-[var(--background)] px-5 py-5 md:px-6">
            {panelLabel("options")}
            <div className="mt-4 grid gap-4">
              <Input
                value={workspaceRoot}
                onChange={(event) => setWorkspaceRoot(event.target.value)}
                placeholder="Workspace root"
              />
              <CheckboxRow
                checked={browserHeadless}
                label="Run browser headless"
                onChange={setBrowserHeadless}
              />
              <div className="border border-[var(--border)] px-4 py-4 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                Carnice is the recommended local path right now. You can also paste any Hugging Face repo
                or file link if you want to install something else.
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://huggingface.co/kai-os/Carnice-9b-GGUF"
                  target="_blank"
                  rel="noreferrer"
                  className="nipux-mono text-[11px] uppercase tracking-[0.14em] text-[var(--foreground)]"
                >
                  Carnice 9B
                </a>
                <a
                  href="https://huggingface.co/kai-os/Carnice-27b-GGUF"
                  target="_blank"
                  rel="noreferrer"
                  className="nipux-mono text-[11px] uppercase tracking-[0.14em] text-[var(--foreground)]"
                >
                  Carnice 27B
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-5 py-5 md:px-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSave(mode === "setup")}
              disabled={pendingAction === "save"}
            >
              Save choices
            </Button>
            {providerMode === "local" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleInstall()}
                  disabled={pendingAction === "install"}
                >
                  Install runtime
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleRuntimeToggle()}
                  disabled={pendingAction === "runtime"}
                >
                  {summary.runtime_state.model_loaded ? "Stop runtime" : "Start runtime"}
                </Button>
              </>
            ) : null}
            {mode === "setup" ? (
              <Button size="sm" onClick={() => void handleContinue()} disabled={pendingAction === "save"}>
                Continue
              </Button>
            ) : null}
          </div>
          {actionError ? (
            <p className="mt-4 text-[13px] leading-[1.6] text-[#d8a499]">{actionError}</p>
          ) : null}
        </div>
      </section>

      <aside className="min-h-0 overflow-auto bg-[var(--background)] px-5 py-5">
        {panelLabel(mode === "setup" ? "setup status" : "status")}
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[14px] text-[var(--foreground)]">Runtime</div>
            <Badge variant={summary.runtime_state.model_loaded ? "success" : "secondary"}>
              {summary.runtime_state.model_loaded ? "live" : "stopped"}
            </Badge>
          </div>
          <div className="space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
            <div>Runtime: {summary.runtime_plan.runtime.label}</div>
            <div>
              Model: {summary.runtime_plan.model ? modelLabel(summary.runtime_plan.model) : "None selected"}
            </div>
            <div>Disk: {summary.runtime_plan.install_plan.estimated_disk_needed_gb.toFixed(1)} GB</div>
          </div>
          {summary.runtime_plan.install_plan.warnings.length ? (
            <div className="border border-[var(--border)] px-4 py-4 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
              {summary.runtime_plan.install_plan.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
          <div>
            {panelLabel("install log")}
            <div className="mt-3 space-y-2 nipux-mono text-[12px] leading-[1.7] text-[var(--foreground)]/78">
              {(installLogs.length ? installLogs.slice(-10) : summary.log_lines.slice(-10)).map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
              {!installLogs.length && !summary.log_lines.length ? (
                <div className="text-[var(--muted-foreground)]">No log output yet.</div>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
