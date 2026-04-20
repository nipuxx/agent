"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";

import { getInstallTask, installRuntime, saveSettings, startRuntime } from "@/lib/api";
import type { NipuxSummary, RuntimeModel, SettingsUpdate } from "@/lib/types";
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

function modelLabel(model: RuntimeModel) {
  if (model.id === "custom") {
    return model.family === "Custom" ? "Custom model" : model.family;
  }
  return `${model.family} ${model.size} ${model.quantization}`;
}

function OptionTile({
  active,
  label,
  body,
  onClick,
}: {
  active: boolean;
  label: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-4 text-left transition-colors ${
        active
          ? "border-[var(--border-strong)] bg-white/[0.03]"
          : "border-[var(--border)] bg-transparent hover:border-[var(--border-strong)]"
      }`}
    >
      <div className="text-[14px] text-[var(--foreground)]">{label}</div>
      <div className="mt-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">{body}</div>
    </button>
  );
}

function selectClassName() {
  return "h-12 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--foreground)] outline-none";
}

const STEPS = ["Provider", "Runtime", "Review"];

export function RuntimeSetupPanel({
  summary,
  refresh,
  onComplete,
}: {
  summary: NipuxSummary;
  refresh: () => Promise<NipuxSummary>;
  onComplete?: () => void;
}) {
  const [step, setStep] = useState(0);
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
          const nextLogs = task.detail.logs ?? [];
          setInstallLogs((current) =>
            JSON.stringify(current) === JSON.stringify(nextLogs) ? current : nextLogs,
          );
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

  const selectedRuntime = runtimeOptions.find((runtime) => runtime.id === runtimeChoice) ?? null;
  const selectedModel = modelOptions.find((model) => model.id === modelChoice) ?? null;
  const installBusy = Boolean(summary.runtime_state.install_task_id);
  const externalSelectionReady = Boolean(endpoint.trim() && modelName.trim());
  const selectionMatchesConfigured =
    providerMode === "local" &&
    summary.runtime_state.runtime_id === runtimeChoice &&
    (summary.runtime_state.active_model_id === modelChoice ||
      summary.runtime_state.recommended_model_id === modelChoice);
  const canEnterDashboard =
    providerMode === "external"
      ? Boolean(summary.settings.setup_completed && endpoint.trim() && modelName.trim())
      : Boolean(
          summary.runtime_state.model_loaded &&
            summary.runtime_state.runtime_id === runtimeChoice &&
            summary.runtime_state.active_model_id === modelChoice,
        );

  function settingsPayload(markSetupComplete = false): SettingsUpdate {
    return {
      setup_completed: markSetupComplete,
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

  function validateStep(targetStep = step): string | null {
    if (targetStep === 0) {
      return providerMode.trim() ? null : "Choose how Nipux should reach a model.";
    }
    if (targetStep === 1) {
      if (providerMode === "external") {
        return externalSelectionReady ? null : "External mode needs an endpoint and model name.";
      }
      if (!runtimeChoice.trim()) {
        return "Choose a runtime.";
      }
      if (!modelChoice.trim()) {
        return "Choose a model.";
      }
      if (modelChoice === "custom" && !customModelRepo.trim()) {
        return "Custom installs need a Hugging Face repo or file link.";
      }
    }
    return null;
  }

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

  async function saveDraft() {
    await withPending("save", async () => {
      await saveSettings(settingsPayload(false));
    });
    await refresh();
  }

  async function handleInstall() {
    await withPending("install", async () => {
      await saveSettings(settingsPayload(false));
      await installRuntime({
        runtime_id: runtimeChoice,
        model_id: modelChoice,
      });
    });
    await refresh();
  }

  async function handleStart() {
    await withPending("start", async () => {
      await saveSettings(settingsPayload(false));
      await startRuntime({
        runtime_id: runtimeChoice,
        model_id: modelChoice,
      });
      await saveSettings(settingsPayload(true));
    });
    await refresh();
    onComplete?.();
  }

  async function handleFinishExternal() {
    await withPending("finish", async () => {
      await saveSettings(settingsPayload(true));
    });
    await refresh();
    onComplete?.();
  }

  async function handlePrimaryAction() {
    if (step < 2) {
      const problem = validateStep(step);
      if (problem) {
        setActionError(problem);
        return;
      }
      setActionError(null);
      setStep((current) => Math.min(current + 1, 2));
      return;
    }

    if (providerMode === "external") {
      await handleFinishExternal();
      return;
    }

    if (canEnterDashboard) {
      onComplete?.();
      return;
    }

    if (installBusy) {
      return;
    }

    if (
      !summary.runtime_state.runtime_installed ||
      !selectionMatchesConfigured ||
      !summary.runtime_state.model_available
    ) {
      await handleInstall();
      return;
    }

    await handleStart();
  }

  const primaryLabel =
    step < 2
      ? "Continue"
      : providerMode === "external"
        ? "Save and enter dashboard"
        : canEnterDashboard
          ? "Enter dashboard"
          : installBusy
            ? "Installing…"
            : !summary.runtime_state.runtime_installed || !selectionMatchesConfigured || !summary.runtime_state.model_available
              ? "Install runtime and model"
              : "Start runtime";

  return (
    <div className="grid h-full min-h-[620px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-h-0 flex-col">
        <header className="border-b border-[var(--border)] px-5 py-5 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              {panelLabel("guided setup")}
              <div className="mt-3 text-[24px] font-medium tracking-[-0.06em] text-[var(--foreground)] md:text-[34px]">
                {STEPS[step]}
              </div>
            </div>
            <Badge variant="secondary">{`${step + 1} / ${STEPS.length}`}</Badge>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {STEPS.map((label, index) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 ${
                      index <= step ? "bg-[var(--foreground)]" : "bg-[var(--foreground)]/16"
                    }`}
                  />
                  <div className="nipux-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    {label}
                  </div>
                </div>
                <div className={`h-px ${index <= step ? "bg-[var(--border-strong)]" : "bg-[var(--border)]"}`} />
              </div>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-6">
          {step === 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <OptionTile
                active={providerMode === "local"}
                label="Local runtime"
                body="Install a runtime on this machine, download a model, and run the agent stack locally."
                onClick={() => setProviderMode("local")}
              />
              <OptionTile
                active={providerMode === "external"}
                label="External endpoint"
                body="Point Nipux at an existing OpenAI-compatible endpoint and skip local runtime setup."
                onClick={() => setProviderMode("external")}
              />

              <div className="border border-[var(--border)] px-4 py-4">
                {panelLabel("workspace")}
                <div className="mt-3 space-y-3">
                  <Input
                    value={workspaceRoot}
                    onChange={(event) => setWorkspaceRoot(event.target.value)}
                    placeholder="Workspace root"
                  />
                  <label className="flex items-center gap-3 text-[14px] text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={browserHeadless}
                      onChange={(event) => setBrowserHeadless(event.target.checked)}
                      className="h-4 w-4 rounded-none border border-[var(--border)] bg-transparent"
                    />
                    <span>Run browser headless</span>
                  </label>
                </div>
              </div>

              <div className="border border-[var(--border)] px-4 py-4">
                {panelLabel("recommended")}
                <div className="mt-3 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  Use Carnice locally if you want the default path. If you need a different model, choose
                  Custom model in the next step and paste a Hugging Face repo or file link.
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                {providerMode === "external" ? (
                  <div className="grid gap-4 border border-[var(--border)] px-4 py-4">
                    {panelLabel("endpoint")}
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
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 border border-[var(--border)] px-4 py-4">
                      {panelLabel("runtime")}
                      <select
                        value={runtimeChoice}
                        onChange={(event) => setRuntimeChoice(event.target.value)}
                        className={selectClassName()}
                      >
                        {runtimeOptions.map((runtime) => (
                          <option key={runtime.id} value={runtime.id} className="bg-[var(--background)]">
                            {runtime.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-4 border border-[var(--border)] px-4 py-4">
                      {panelLabel("model")}
                      <select
                        value={modelChoice}
                        onChange={(event) => setModelChoice(event.target.value)}
                        className={selectClassName()}
                      >
                        {modelOptions.map((model) => (
                          <option key={model.id} value={model.id} className="bg-[var(--background)]">
                            {modelLabel(model)}
                          </option>
                        ))}
                      </select>

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
                    </div>
                  </>
                )}
              </div>

              <aside className="border border-[var(--border)] px-4 py-4">
                {panelLabel("selection")}
                <div className="mt-4 space-y-3 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  <div>Mode: {providerMode === "local" ? "Local runtime" : "External endpoint"}</div>
                  {providerMode === "local" ? (
                    <>
                      <div>Runtime: {selectedRuntime?.label ?? "Choose a runtime"}</div>
                      <div>Model: {selectedModel ? modelLabel(selectedModel) : "Choose a model"}</div>
                    </>
                  ) : (
                    <>
                      <div>Endpoint: {endpoint || "Not set"}</div>
                      <div>Model: {modelName || "Not set"}</div>
                    </>
                  )}
                  <div>Workspace: {workspaceRoot || "Default workspace"}</div>
                </div>

                <div className="mt-6 space-y-2">
                  <a
                    href="https://huggingface.co/kai-os/Carnice-9b-GGUF"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-[13px] text-[var(--foreground)]"
                  >
                    Carnice 9B
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href="https://huggingface.co/kai-os/Carnice-27b-GGUF"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-[13px] text-[var(--foreground)]"
                  >
                    Carnice 27B
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </aside>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div className="grid gap-4 border border-[var(--border)] px-4 py-4">
                  {panelLabel("review")}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="border border-[var(--border)] px-4 py-4">
                      <div className="text-[14px] text-[var(--foreground)]">Provider</div>
                      <div className="mt-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                        {providerMode === "local" ? "Local runtime" : "External endpoint"}
                      </div>
                    </div>
                    <div className="border border-[var(--border)] px-4 py-4">
                      <div className="text-[14px] text-[var(--foreground)]">Workspace</div>
                      <div className="mt-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                        {workspaceRoot || "Default workspace"}
                      </div>
                    </div>
                    {providerMode === "local" ? (
                      <>
                        <div className="border border-[var(--border)] px-4 py-4">
                          <div className="text-[14px] text-[var(--foreground)]">Runtime</div>
                          <div className="mt-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                            {selectedRuntime?.label ?? "Not selected"}
                          </div>
                        </div>
                        <div className="border border-[var(--border)] px-4 py-4">
                          <div className="text-[14px] text-[var(--foreground)]">Model</div>
                          <div className="mt-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                            {selectedModel ? modelLabel(selectedModel) : "Not selected"}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="border border-[var(--border)] px-4 py-4">
                          <div className="text-[14px] text-[var(--foreground)]">Endpoint</div>
                          <div className="mt-2 break-all text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                            {endpoint || "Not set"}
                          </div>
                        </div>
                        <div className="border border-[var(--border)] px-4 py-4">
                          <div className="text-[14px] text-[var(--foreground)]">Model</div>
                          <div className="mt-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                            {modelName || "Not set"}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {providerMode === "local" ? (
                  <div className="grid gap-4 border border-[var(--border)] px-4 py-4">
                    {panelLabel("provisioning")}
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="border border-[var(--border)] px-4 py-4">
                        <div className="text-[14px] text-[var(--foreground)]">Runtime install</div>
                        <div className="mt-2 text-[13px] text-[var(--muted-foreground)]">
                          {summary.runtime_state.runtime_installed ? "Ready" : "Pending"}
                        </div>
                      </div>
                      <div className="border border-[var(--border)] px-4 py-4">
                        <div className="text-[14px] text-[var(--foreground)]">Model payload</div>
                        <div className="mt-2 text-[13px] text-[var(--muted-foreground)]">
                          {summary.runtime_state.model_available && selectionMatchesConfigured ? "Ready" : "Pending"}
                        </div>
                      </div>
                      <div className="border border-[var(--border)] px-4 py-4">
                        <div className="text-[14px] text-[var(--foreground)]">Runtime health</div>
                        <div className="mt-2 text-[13px] text-[var(--muted-foreground)]">
                          {summary.runtime_state.model_loaded && canEnterDashboard ? "Running" : "Not live"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="border border-[var(--border)] px-4 py-4">
                {panelLabel("status")}
                <div className="mt-4 space-y-4">
                  {providerMode === "local" ? (
                    <div className="space-y-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                      <div>Disk estimate: {summary.runtime_plan.install_plan.estimated_disk_needed_gb.toFixed(1)} GB</div>
                      <div>Endpoint: {summary.runtime_state.endpoint || "Not started"}</div>
                    </div>
                  ) : (
                    <div className="text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                      Nipux will save the external endpoint and send you straight to the dashboard.
                    </div>
                  )}

                  {summary.runtime_plan.install_plan.warnings.length ? (
                    <div className="border border-[var(--border)] px-4 py-4 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                      {summary.runtime_plan.install_plan.warnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  ) : null}

                  {actionError || summary.runtime_state.last_error ? (
                    <div className="border border-[var(--danger)]/45 px-4 py-4 text-[13px] leading-[1.7] text-[#d8a499]">
                      {actionError || summary.runtime_state.last_error}
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
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
              disabled={step === 0 || pendingAction !== null}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void saveDraft()}
              disabled={pendingAction !== null}
            >
              Save draft
            </Button>
          </div>

          <Button size="sm" onClick={() => void handlePrimaryAction()} disabled={pendingAction !== null || (step === 2 && installBusy)}>
            {step === 2 && canEnterDashboard ? <Check className="mr-2 h-4 w-4" /> : null}
            {primaryLabel}
            {step < 2 ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </Button>
        </footer>
      </section>
    </div>
  );
}
