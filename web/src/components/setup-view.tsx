"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Cpu, Download, HardDrive, Layers3, Sparkles } from "lucide-react";
import { AppShell } from "./app-shell";
import { Panel } from "./panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getSummary } from "@/lib/api";
import {
  formatDeviceMeta,
  getDeviceOptions,
  getModelOptions,
  getRecommendedModel,
  getRecommendedRuntime,
  getRuntimeOptions,
  type DeviceOption,
} from "@/lib/planner";
import type { ModelSummary, NipuxSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Hardware", "Runtime", "Model", "Review"];

function StepDot({ index, current }: { index: number; current: number }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-sm border text-xs font-medium",
        index <= current
          ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]",
      )}
    >
      {index + 1}
    </div>
  );
}

export function SetupView() {
  const [summary, setSummary] = useState<NipuxSummary | null>(null);
  const [step, setStep] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [memoryBudgetGb, setMemoryBudgetGb] = useState<number>(0);
  const [installQueued, setInstallQueued] = useState(false);

  useEffect(() => {
    getSummary().then(setSummary);
  }, []);

  const devices = useMemo(() => (summary ? getDeviceOptions(summary) : []), [summary]);
  const selectedDevice = useMemo<DeviceOption | null>(
    () => devices.find((device) => device.id === selectedDeviceId) ?? devices[0] ?? null,
    [devices, selectedDeviceId],
  );

  useEffect(() => {
    if (!summary || devices.length === 0) return;
    const recommendedDevice = devices[0];
    setSelectedDeviceId(recommendedDevice.id);
    setMemoryBudgetGb(recommendedDevice.budgetGb);
    const recommendedRuntime = getRecommendedRuntime(summary, recommendedDevice);
    setSelectedRuntimeId(recommendedRuntime);
    const recommendedModel = getRecommendedModel(summary, recommendedRuntime, recommendedDevice.budgetGb);
    setSelectedModelId(recommendedModel?.id ?? "");
  }, [summary, devices]);

  const runtimeOptions = useMemo(
    () => (summary ? getRuntimeOptions(summary, selectedDevice) : []),
    [summary, selectedDevice],
  );
  const modelOptions = useMemo(
    () => (summary ? getModelOptions(summary, selectedRuntimeId, memoryBudgetGb) : []),
    [summary, selectedRuntimeId, memoryBudgetGb],
  );
  const selectedModel = useMemo<ModelSummary | null>(
    () => modelOptions.find((model) => model.id === selectedModelId) ?? modelOptions.at(-1) ?? null,
    [modelOptions, selectedModelId],
  );
  const recommendedModel = useMemo(
    () => (summary ? getRecommendedModel(summary, selectedRuntimeId, memoryBudgetGb) : null),
    [summary, selectedRuntimeId, memoryBudgetGb],
  );

  if (!summary) {
    return (
      <AppShell title="Configs" subtitle="Loading Nipux onboarding…">
        <div className="text-sm text-[var(--muted-foreground)]">Loading…</div>
      </AppShell>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const budgetMax = Math.max(8, Math.round(selectedDevice?.budgetGb ?? 8));
  const installDisk = summary.install_plan.estimated_disk_needed_gb.toFixed(1);

  return (
    <AppShell
      title="Configs"
      subtitle="Pick the runtime and model here. Nipux does not install the runtime or download model weights until you confirm this flow."
    >
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          {STEPS.map((label, index) => (
            <div key={label} className="flex items-center gap-3">
              <StepDot index={index} current={step} />
              <span className="hidden text-sm text-[var(--muted-foreground)] md:inline">{label}</span>
              {index < STEPS.length - 1 ? <div className="hidden h-px w-8 bg-[var(--border)] md:block" /> : null}
            </div>
          ))}
        </div>
        <Progress value={progress} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel
          title={STEPS[step]}
          description="This setup flow owns all runtime and model changes. It is intentionally explicit."
          right={<Badge variant="secondary">Step {step + 1} of {STEPS.length}</Badge>}
        >
          {step === 0 ? (
            <div className="space-y-4">
              <div className="rounded-md border border-[var(--border)] bg-[var(--card-2)] p-4 text-sm text-[var(--muted-foreground)]">
                Nipux detected {summary.system.chip_name ?? summary.system.cpu_model} on {summary.system.platform}. Pick the accelerator and memory budget you want to use for local inference.
              </div>
              <div className="grid gap-3">
                {devices.map((device) => {
                  const active = selectedDevice?.id === device.id;
                  return (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => {
                        setSelectedDeviceId(device.id);
                        setMemoryBudgetGb(device.budgetGb);
                        const runtime = getRecommendedRuntime(summary, device);
                        setSelectedRuntimeId(runtime);
                        const nextModel = getRecommendedModel(summary, runtime, device.budgetGb);
                        setSelectedModelId(nextModel?.id ?? "");
                      }}
                      className={cn(
                        "rounded-md border p-4 text-left transition-colors",
                        active
                          ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : "border-[var(--border)] bg-[var(--card-2)] text-[var(--foreground)] hover:bg-[var(--card)]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{device.label}</div>
                        <Badge variant={active ? "default" : "secondary"}>{device.vendor}</Badge>
                      </div>
                      <div className={cn("mt-2 text-sm", active ? "text-[var(--accent-foreground)]/80" : "text-[var(--muted-foreground)]")}>
                        {device.details}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--card-2)] p-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="memory-budget">Memory budget</Label>
                  <div className="text-sm text-[var(--muted-foreground)]">{memoryBudgetGb.toFixed(0)} GB</div>
                </div>
                <Input
                  id="memory-budget"
                  type="range"
                  min={selectedDevice?.vendor === "Apple" ? 12 : 8}
                  max={budgetMax}
                  step={1}
                  value={memoryBudgetGb}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setMemoryBudgetGb(value);
                    const nextModel = getRecommendedModel(summary, selectedRuntimeId, value);
                    if (nextModel) setSelectedModelId(nextModel.id);
                  }}
                  className="h-3 border-0 bg-transparent px-0"
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {runtimeOptions.map((runtime) => {
                const active = runtime.id === selectedRuntimeId;
                return (
                  <button
                    key={runtime.id}
                    type="button"
                    onClick={() => {
                      setSelectedRuntimeId(runtime.id);
                      const nextModel = getRecommendedModel(summary, runtime.id, memoryBudgetGb);
                      setSelectedModelId(nextModel?.id ?? "");
                    }}
                    className={cn(
                      "rounded-md border p-4 text-left transition-colors",
                      active
                        ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "border-[var(--border)] bg-[var(--card-2)] hover:bg-[var(--card)]",
                    )}
                  >
                    <div className="font-medium">{runtime.label}</div>
                    <div className={cn("mt-2 text-sm leading-6", active ? "text-[var(--accent-foreground)]/80" : "text-[var(--muted-foreground)]")}>
                      {runtime.best_for}
                    </div>
                    <div className={cn("mt-3 text-xs", active ? "text-[var(--accent-foreground)]/70" : "text-[var(--muted-foreground)]")}>
                      Install footprint ~{runtime.install_size_gb} GB
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="rounded-md border border-[var(--border)] bg-[var(--card-2)] p-4 text-sm text-[var(--muted-foreground)]">
                Nipux recommends the highest-quality Carnice build that still fits your chosen memory budget.
              </div>
              <div className="grid gap-3">
                {modelOptions.map((model) => {
                  const active = model.id === selectedModel?.id;
                  const recommended = model.id === recommendedModel?.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModelId(model.id)}
                      className={cn(
                        "rounded-md border p-4 text-left transition-colors",
                        active
                          ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : "border-[var(--border)] bg-[var(--card-2)] hover:bg-[var(--card)]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">
                          {model.family} {model.size} {model.quantization}
                        </div>
                        {recommended ? <Badge variant="success">Recommended</Badge> : null}
                      </div>
                      <div className={cn("mt-2 text-sm leading-6", active ? "text-[var(--accent-foreground)]/80" : "text-[var(--muted-foreground)]")}>
                        Runtime {model.runtime} · Min memory {model.min_vram_gb} GB · Artifact {model.artifact_kind}
                      </div>
                      <div className={cn("mt-2 text-xs", active ? "text-[var(--accent-foreground)]/70" : "text-[var(--muted-foreground)]")}>
                        {model.notes}
                      </div>
                    </button>
                  );
                })}
                {modelOptions.length === 0 ? (
                  <div className="rounded-md border border-[var(--border)] bg-[var(--card-2)] p-4 text-sm text-[var(--muted-foreground)]">
                    No models fit the current runtime and memory budget. Increase the budget or switch the runtime.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="rounded-md border border-[var(--border)] bg-[var(--card-2)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Review before install</div>
                  <Badge variant="secondary">No install yet</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-sm border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Device</div>
                    <div className="mt-2 text-sm">{selectedDevice?.label ?? "None"}</div>
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">{selectedDevice?.details}</div>
                  </div>
                  <div className="rounded-sm border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Runtime</div>
                    <div className="mt-2 text-sm">{selectedRuntimeId || "None"}</div>
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">Nothing is installed until you click Start install.</div>
                  </div>
                  <div className="rounded-sm border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Model</div>
                    <div className="mt-2 text-sm">
                      {selectedModel ? `${selectedModel.family} ${selectedModel.size} ${selectedModel.quantization}` : "None"}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {selectedModel?.repo ?? "No repo selected"}
                    </div>
                  </div>
                  <div className="rounded-sm border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Estimated disk</div>
                    <div className="mt-2 text-sm">{installDisk} GB</div>
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                      Includes runtime payload and model artifact estimate.
                    </div>
                  </div>
                </div>
              </div>
              {installQueued ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--card-2)] p-4 text-sm text-[var(--muted-foreground)]">
                  Install intent captured in the UI layer. The next backend pass should wire this button to real daemon actions for runtime install and model download.
                </div>
              ) : null}
            </div>
          ) : null}

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>
                Continue
              </Button>
            ) : (
              <Button onClick={() => setInstallQueued(true)} disabled={!selectedModel}>
                Start install
              </Button>
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Recommended now" description="Current daemon recommendation">
            <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4" />
                <span>{summary.system.chip_name ?? summary.system.cpu_model}</span>
              </div>
              <div className="flex items-center gap-3">
                <Layers3 className="h-4 w-4" />
                <span>{summary.runtime.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4" />
                <span>
                  {summary.recommendation.selected
                    ? `${summary.recommendation.selected.family} ${summary.recommendation.selected.size} ${summary.recommendation.selected.quantization}`
                    : "No supported Carnice build"}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Why the flow is explicit" description="Nipux should never start by surprise.">
            <div className="space-y-3 text-sm leading-7 text-[var(--muted-foreground)]">
              <p>
                Runtime installation, model download, and Hermes profile generation are intentionally
                gated behind this setup flow.
              </p>
              <p>
                That keeps the first run understandable and lets advanced users override the device,
                memory budget, runtime, and model selection before anything touches the machine.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
