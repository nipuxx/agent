"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ThemePicker } from "./theme-picker";
import { getInstallTask, installRuntime, saveSettings, startRuntime, stopRuntime } from "@/lib/api";
import { DEFAULT_THEME_ID, applyTheme, themeById } from "@/lib/themes";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SettingsSection = "provider" | "model" | "runtime" | "theme" | "browser" | "limits" | "workspace";

const SECTIONS: Array<{ id: SettingsSection; label: string; note: string }> = [
  { id: "provider", label: "Provider", note: "Local or OpenAI-compatible endpoint" },
  { id: "model", label: "Model", note: "Recommended and custom weights" },
  { id: "runtime", label: "Runtime", note: "Install, start, stop, health" },
  { id: "theme", label: "Theme", note: "Interface style" },
  { id: "browser", label: "Browser", note: "Headless browser defaults" },
  { id: "limits", label: "Limits", note: "Long-run budgets" },
  { id: "workspace", label: "Workspace", note: "Tools and storage" },
];

function panelLabel(label: string) {
  return <div className="nipux-label">{label}</div>;
}

function FieldLabel({ children }: { children: string }) {
  return <div className="mb-2 text-[13px] text-[var(--muted-foreground)]">{children}</div>;
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-[var(--control-height)] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--field-bg)] px-[var(--control-padding-x)] text-[14px] text-[var(--foreground)] shadow-[var(--control-shadow)] outline-none"
    >
      {children}
    </select>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  note,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  note: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 border-b border-[var(--border)] py-4 last:border-b-0">
      <span>
        <span className="block text-[14px] text-[var(--foreground)]">{label}</span>
        <span className="mt-1 block text-[12px] leading-[1.6] text-[var(--muted-foreground)]">{note}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded-none border border-[var(--border)] bg-transparent"
      />
    </label>
  );
}

export function SettingsPanel({
  modal = false,
  onClose,
}: {
  modal?: boolean;
  onClose?: () => void;
}) {
  const { summary, loading, error, refresh } = useLiveSummary();
  const [activeSection, setActiveSection] = useState<SettingsSection>("provider");
  const [themeChoice, setThemeChoice] = useState<string>(DEFAULT_THEME_ID);
  const [hydratedKey, setHydratedKey] = useState("");
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
  const settingsKey = useMemo(
    () =>
      summary
        ? JSON.stringify({
            theme_id: summary.settings.theme_id,
            preferred_runtime_id: summary.settings.preferred_runtime_id,
            preferred_model_id: summary.settings.preferred_model_id,
            provider_mode: summary.settings.provider_mode,
            openai_base_url: summary.settings.openai_base_url,
            openai_api_key: summary.settings.openai_api_key,
            openai_model: summary.settings.openai_model,
            worker_action_budget: summary.settings.worker_action_budget,
            checkpoint_every_actions: summary.settings.checkpoint_every_actions,
            max_runtime_minutes: summary.settings.max_runtime_minutes,
            workspace_root: summary.settings.workspace_root,
            browser_headless: summary.settings.browser_headless,
            browser_viewport: summary.settings.browser_viewport,
            allow_terminal: summary.settings.allow_terminal,
            allow_browser: summary.settings.allow_browser,
            allow_file_tools: summary.settings.allow_file_tools,
            custom_model_name: summary.settings.custom_model_name,
            custom_model_repo: summary.settings.custom_model_repo,
            custom_model_filename: summary.settings.custom_model_filename,
            custom_model_size_gb: summary.settings.custom_model_size_gb,
            runtime_id: summary.runtime_plan.runtime.id,
            recommended_model_id: summary.runtime_plan.recommendation.selected_model_id,
          })
        : "",
    [summary],
  );

  useEffect(() => {
    if (!summary) return;
    if (hydratedKey === settingsKey) return;
    const nextTheme = themeById(summary.settings.theme_id).id;
    setThemeChoice(nextTheme);
    applyTheme(nextTheme);
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
    setHydratedKey(settingsKey);
  }, [hydratedKey, settingsKey, summary]);

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
      theme_id: themeChoice,
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
      <div className="flex h-full items-center justify-center nipux-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        Loading settings...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-[15px] text-[var(--muted-foreground)]">
        {error ?? "Settings are unavailable."}
      </div>
    );
  }

  const selectedModel = modelOptions.find((item) => item.id === preferredModel);
  const selectedRuntime = runtimeOptions.find((item) => item.id === preferredRuntime);

  return (
    <section
      className={cn(
        "grid min-h-0 min-w-0 overflow-hidden",
        modal ? "h-full grid-rows-[auto_minmax(0,1fr)_auto]" : "h-screen grid-rows-[auto_minmax(0,1fr)_auto]",
      )}
    >
      <header className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            {panelLabel("settings")}
            <div className="nipux-title mt-2 text-[26px] text-[var(--foreground)]">Nipux preferences</div>
          </div>
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
        {actionError ? <p className="mt-3 text-[14px] text-[var(--danger)]">{actionError}</p> : null}
      </header>

      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-auto border-b border-[var(--border)] p-3 md:border-b-0 md:border-r">
          <div className="grid gap-1">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors",
                  activeSection === item.id ? "bg-[var(--active-surface)] text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--hover-surface)] hover:text-[var(--foreground)]",
                )}
              >
                <div className="text-[14px]">{item.label}</div>
                <div className="mt-1 text-[11px] leading-[1.4] text-[var(--subtle-foreground)]">{item.note}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-h-0 overflow-auto p-5">
          {activeSection === "provider" ? (
            <div className="grid gap-5">
              <section className="nipux-panel p-[var(--panel-padding)]">
                {panelLabel("provider")}
                <div className="mt-4 grid gap-4">
                  <div>
                    <FieldLabel>Serving mode</FieldLabel>
                    <SelectField value={providerMode} onChange={setProviderMode}>
                      <option value="local" className="bg-[var(--background)]">Local runtime</option>
                      <option value="external" className="bg-[var(--background)]">OpenAI-compatible endpoint</option>
                    </SelectField>
                  </div>
                  <div className="text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                    Local mode keeps model serving on this machine. External mode points Nipux at any OpenAI-compatible chat endpoint.
                  </div>
                </div>
              </section>
              {providerMode === "external" ? (
                <section className="nipux-panel p-[var(--panel-padding)]">
                  {panelLabel("endpoint")}
                  <div className="mt-4 grid gap-4">
                    <Input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="Base URL, for example http://host:8000/v1" />
                    <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="API key" />
                    <Input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="Model name" />
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {activeSection === "model" ? (
            <div className="grid gap-5">
              <section className="nipux-panel p-[var(--panel-padding)]">
                {panelLabel("model")}
                <div className="mt-4 grid gap-4">
                  <div>
                    <FieldLabel>Recommended model</FieldLabel>
                    <SelectField value={preferredModel} onChange={setPreferredModel}>
                      {modelOptions.map((item) => (
                        <option key={item.id} value={item.id} className="bg-[var(--background)]">
                          {item.family} {item.size} {item.quantization}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="grid gap-3 text-[13px] leading-[1.7] text-[var(--muted-foreground)] sm:grid-cols-2">
                    <div>Selected: {selectedModel ? `${selectedModel.family} ${selectedModel.size} ${selectedModel.quantization}` : "custom or unavailable"}</div>
                    <div>Repo: {selectedModel?.repo || customModelRepo || "none"}</div>
                    <div>Minimum VRAM: {selectedModel ? `${selectedModel.min_vram_gb} GB` : "manual"}</div>
                    <div>Target RAM: {selectedModel ? `${selectedModel.target_ram_gb} GB` : "manual"}</div>
                  </div>
                </div>
              </section>
              <section className="nipux-panel p-[var(--panel-padding)]">
                {panelLabel("custom model")}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input value={customModelName} onChange={(event) => setCustomModelName(event.target.value)} placeholder="Display label" />
                  <Input value={customModelRepo} onChange={(event) => setCustomModelRepo(event.target.value)} placeholder="Hugging Face repo or file URL" />
                  <Input value={customModelFilename} onChange={(event) => setCustomModelFilename(event.target.value)} placeholder="Filename override" />
                  <Input value={customModelSizeGb} onChange={(event) => setCustomModelSizeGb(event.target.value)} placeholder="Approx size in GB" />
                </div>
                <div className="mt-3 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  Choose the custom model entry in the model selector to install from these fields.
                </div>
              </section>
            </div>
          ) : null}

          {activeSection === "runtime" ? (
            <div className="grid gap-5">
              <section className="nipux-panel p-[var(--panel-padding)]">
                {panelLabel("runtime")}
                <div className="mt-4 grid gap-4">
                  <div>
                    <FieldLabel>Runtime engine</FieldLabel>
                    <SelectField value={preferredRuntime} onChange={setPreferredRuntime}>
                      {runtimeOptions.map((item) => (
                        <option key={item.id} value={item.id} className="bg-[var(--background)]">
                          {item.label}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="grid gap-3 text-[13px] leading-[1.7] text-[var(--muted-foreground)] sm:grid-cols-2">
                    <div>Current status: {summary.runtime_state.status}</div>
                    <div>Loaded: {summary.runtime_state.model_loaded ? "yes" : "no"}</div>
                    <div>Runtime: {summary.runtime_state.runtime_id || selectedRuntime?.id || "none"}</div>
                    <div>Endpoint: {summary.runtime_state.endpoint || endpoint || "none"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void handleInstall()} disabled={pending || providerMode !== "local"}>
                      Install selected
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleRuntimeToggle()} disabled={pending || providerMode !== "local"}>
                      {summary.runtime_state.model_loaded ? "Stop runtime" : "Start runtime"}
                    </Button>
                  </div>
                </div>
              </section>
              <section className="nipux-panel p-[var(--panel-padding)]">
                {panelLabel("install log")}
                <div className="mt-4 max-h-[220px] overflow-auto space-y-3 nipux-mono text-[12px] leading-[1.7] text-[var(--foreground)]/84">
                  {taskLogs.length ? taskLogs.slice(-24).map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : <div>No active install task.</div>}
                </div>
              </section>
            </div>
          ) : null}

          {activeSection === "theme" ? (
            <section className="nipux-panel p-[var(--panel-padding)]">
              {panelLabel("theme")}
              <div className="mt-4">
                <ThemePicker value={themeChoice} onChange={setThemeChoice} compact />
              </div>
            </section>
          ) : null}

          {activeSection === "browser" ? (
            <section className="nipux-panel p-[var(--panel-padding)]">
              {panelLabel("browser")}
              <div className="mt-4">
                <ToggleRow checked={browserHeadless} onChange={setBrowserHeadless} label="Run headless" note="Agents use browser automation without showing the browser in the UI." />
                <ToggleRow checked={allowBrowser} onChange={setAllowBrowser} label="Allow browser tool" note="Permit agents to navigate, inspect, and interact with web pages." />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input value={browserWidth} onChange={(event) => setBrowserWidth(event.target.value)} placeholder="Viewport width" />
                  <Input value={browserHeight} onChange={(event) => setBrowserHeight(event.target.value)} placeholder="Viewport height" />
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "limits" ? (
            <section className="nipux-panel p-[var(--panel-padding)]">
              {panelLabel("limits")}
              <div className="mt-4 grid gap-4">
                <Input value={actionBudget} onChange={(event) => setActionBudget(event.target.value)} placeholder="Worker action budget per pass" />
                <Input value={checkpointEvery} onChange={(event) => setCheckpointEvery(event.target.value)} placeholder="Checkpoint every N actions" />
                <Input value={maxRuntimeMinutes} onChange={(event) => setMaxRuntimeMinutes(event.target.value)} placeholder="Max runtime minutes" />
                <div className="text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  Keep these bounded. Long-running agents should checkpoint and resume rather than run an unbounded loop.
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "workspace" ? (
            <div className="grid gap-5">
              <section className="nipux-panel p-[var(--panel-padding)]">
                {panelLabel("workspace")}
                <div className="mt-4 grid gap-4">
                  <Input value={workspaceRoot} onChange={(event) => setWorkspaceRoot(event.target.value)} placeholder="Workspace root" />
                  <ToggleRow checked={allowTerminal} onChange={setAllowTerminal} label="Terminal tool" note="Permit shell commands inside each agent workspace." />
                  <ToggleRow checked={allowFiles} onChange={setAllowFiles} label="File tools" note="Permit reading and writing files in the workspace." />
                </div>
              </section>
              <section className="nipux-panel p-[var(--panel-padding)]">
                {panelLabel("system")}
                <div className="mt-4 grid gap-2 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                  <div>Setup: {summary.settings.setup_completed ? "complete" : "incomplete"}</div>
                  <div>Runtime: {summary.runtime_state.runtime_id || "none"}</div>
                  <div>Model: {summary.runtime_state.active_model_id || summary.settings.openai_model || "none"}</div>
                  <div>Host RAM: {summary.telemetry.ram_used_gb.toFixed(1)} / {summary.telemetry.ram_total_gb.toFixed(1)} GB</div>
                </div>
              </section>
            </div>
          ) : null}
        </main>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
        <div className="truncate text-[12px] text-[var(--muted-foreground)]">
          {providerMode === "local" ? "Local runtime settings apply after save, install, or restart." : "External provider settings apply after save."}
        </div>
        <div className="flex gap-2">
          {onClose ? (
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          ) : null}
          <Button size="sm" onClick={() => void handleSave()} disabled={pending}>
            Save
          </Button>
        </div>
      </footer>
    </section>
  );
}
