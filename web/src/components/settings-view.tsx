"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { AppShell } from "./app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHermesSettings, getSummary, saveHermesSettings } from "@/lib/api";
import type { HermesSettingsSummary, HermesSettingsUpdate, NipuxSummary } from "@/lib/types";

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
      <span className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
        {label}
      </span>
      <span className="ml-6 max-w-[68%] text-right nipux-mono text-[13px] uppercase tracking-[0.12em] break-all">
        {value}
      </span>
    </div>
  );
}

export function SettingsView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);
  const [settings, setSettings] = useState<HermesSettingsSummary | null>(null);
  const [secretDrafts, setSecretDrafts] = useState({
    openrouter_api_key: "",
    openai_api_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const [summaryValue, settingsValue] = await Promise.all([getSummary(), getHermesSettings()]);
      if (!mounted) return;
      setSummary(summaryValue);
      setSettings(settingsValue);
    };
    void refresh();
    return () => {
      mounted = false;
    };
  }, []);

  const toolsetText = useMemo(() => settings?.toolsets.join(", ") ?? "", [settings]);

  if (!summary || !settings) {
    return (
      <AppShell>
        <div className="px-10 py-10">
          <div className="nipux-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            Loading_hermes_settings
          </div>
        </div>
      </AppShell>
    );
  }

  const updateField = <K extends keyof HermesSettingsSummary>(key: K, value: HermesSettingsSummary[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    setSaving(true);
    const payload: HermesSettingsUpdate = {
      model: settings.model,
      toolsets: toolsetText,
      max_turns: settings.max_turns,
      terminal_backend: settings.terminal_backend,
      terminal_cwd: settings.terminal_cwd,
      compression_enabled: settings.compression_enabled,
      compression_threshold: settings.compression_threshold,
      display_personality: settings.display_personality,
      openai_base_url: settings.openai_base_url,
      openrouter_api_key: secretDrafts.openrouter_api_key || undefined,
      openai_api_key: secretDrafts.openai_api_key || undefined,
    };
    const next = await saveHermesSettings(payload);
    setSettings(next);
    setSecretDrafts({ openrouter_api_key: "", openai_api_key: "" });
    setSummary(await getSummary());
    setSaving(false);
  };

  const copyInstallCommand = async () => {
    await navigator.clipboard.writeText(summary.hermes.install_command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <AppShell telemetry={summary.telemetry}>
      <section className="border-b border-[var(--border)] px-10 py-10">
        <div className="nipux-mono text-[12px] uppercase tracking-[0.3em] text-[var(--muted-foreground)]">
          Hermes_settings
        </div>
        <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <h1 className="nipux-display text-[108px] uppercase leading-[0.84]">System_Config</h1>
            <p className="mt-4 max-w-[780px] text-[28px] leading-[1.22] text-[var(--muted-foreground)]">
              Nipux does not own agent logic. Hermes stays separate, installs separately, and this
              panel edits Hermes configuration directly.
            </p>
          </div>

          <div className="nipux-panel-soft px-6 py-6">
            <div className="grid gap-4">
              <StatusLine label="Hermes" value={summary.hermes.installed ? "INSTALLED" : "NOT_INSTALLED"} />
              <StatusLine label="Configured" value={summary.hermes.configured ? "READY" : "PARTIAL"} />
              <StatusLine label="Gateway" value={summary.hermes.gateway_running ? "ONLINE" : "CLI_MODE"} />
              <StatusLine label="Version" value={summary.hermes.version || "UNKNOWN"} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-px bg-[var(--border)] xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="grid gap-px bg-[var(--border)]">
          <div className="nipux-panel grid gap-5 px-8 py-7">
            <div className="nipux-mono text-[12px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Runtime
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Model
                </Label>
                <Input value={settings.model} onChange={(event) => updateField("model", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  OpenAI Base URL
                </Label>
                <Input
                  value={settings.openai_base_url}
                  onChange={(event) => updateField("openai_base_url", event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="nipux-panel grid gap-5 px-8 py-7">
            <div className="nipux-mono text-[12px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Execution
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Toolsets
                </Label>
                <Input
                  value={toolsetText}
                  onChange={(event) =>
                    updateField(
                      "toolsets",
                      event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Terminal backend
                </Label>
                <Input
                  value={settings.terminal_backend}
                  onChange={(event) => updateField("terminal_backend", event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Working directory
                </Label>
                <Input
                  value={settings.terminal_cwd}
                  onChange={(event) => updateField("terminal_cwd", event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="nipux-panel grid gap-5 px-8 py-7">
            <div className="nipux-mono text-[12px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Behavior
            </div>
            <div className="grid gap-5 md:grid-cols-4">
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Max turns
                </Label>
                <Input
                  type="number"
                  value={settings.max_turns}
                  onChange={(event) => updateField("max_turns", Number(event.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Compression
                </Label>
                <Input
                  value={settings.compression_enabled ? "enabled" : "disabled"}
                  onChange={(event) =>
                    updateField("compression_enabled", event.target.value.trim().toLowerCase() !== "disabled")
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Threshold
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.compression_threshold}
                  onChange={(event) => updateField("compression_threshold", Number(event.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Personality
                </Label>
                <Input
                  value={settings.display_personality}
                  onChange={(event) => updateField("display_personality", event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="nipux-panel flex items-center justify-between px-8 py-6">
            <div className="nipux-mono text-[12px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              Writes directly to Hermes config.yaml and .env
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save_to_hermes"}
            </Button>
          </div>
        </div>

        <aside className="grid gap-px bg-[var(--border)]">
          <div className="nipux-panel px-8 py-7">
            <div className="flex items-center justify-between">
              <div className="nipux-mono text-[12px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                Hermes_install
              </div>
              <Badge variant={summary.hermes.installed ? "secondary" : "default"}>
                {summary.hermes.installed ? "READY" : "REQUIRED"}
              </Badge>
            </div>
            <div className="mt-5 nipux-mono text-[13px] uppercase leading-7 text-[var(--muted-foreground)]">
              Nipux keeps Hermes separate. If Hermes is missing, install it first and then return
              here to configure the runtime.
            </div>
            <div className="mt-5 border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <div className="nipux-mono text-[12px] leading-7">{summary.hermes.install_command}</div>
            </div>
            <div className="mt-5">
              <Button variant="outline" onClick={copyInstallCommand}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy_install"}
              </Button>
            </div>
          </div>

          <div className="nipux-panel px-8 py-7">
            <div className="nipux-mono text-[12px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Paths
            </div>
            <div className="mt-5 grid gap-4">
              <StatusLine label="Binary" value={summary.hermes.binary || "NOT_FOUND"} />
              <StatusLine label="Home" value={summary.hermes.home} />
              <StatusLine label="Config" value={summary.hermes.config_path} />
              <StatusLine label="Env" value={summary.hermes.env_path} />
            </div>
          </div>

          <div className="nipux-panel px-8 py-7">
            <div className="nipux-mono text-[12px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Secrets
            </div>
            <div className="mt-5 grid gap-4">
              <StatusLine
                label="OpenRouter"
                value={settings.openrouter_api_key_set ? settings.openrouter_api_key_hint : "NOT_SET"}
              />
              <StatusLine
                label="OpenAI"
                value={settings.openai_api_key_set ? settings.openai_api_key_hint : "NOT_SET"}
              />
            </div>
            <div className="mt-5 grid gap-4">
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Update OpenRouter key
                </Label>
                <Input
                  type="password"
                  value={secretDrafts.openrouter_api_key}
                  placeholder="leave blank to keep current"
                  onChange={(event) =>
                    setSecretDrafts((current) => ({
                      ...current,
                      openrouter_api_key: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label className="nipux-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Update OpenAI key
                </Label>
                <Input
                  type="password"
                  value={secretDrafts.openai_api_key}
                  placeholder="leave blank to keep current"
                  onChange={(event) =>
                    setSecretDrafts((current) => ({
                      ...current,
                      openai_api_key: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="mt-5 nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Keys stay in Hermes .env. Nipux only shows masked state here.
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
