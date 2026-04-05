import type { GpuInfo, ModelSummary, NipuxSummary, RuntimeProfile } from "./types";

export interface DeviceOption {
  id: string;
  label: string;
  vendor: string;
  memoryKind: string;
  budgetGb: number;
  details: string;
}

export function getDeviceOptions(summary: NipuxSummary): DeviceOption[] {
  if (summary.system.gpus.length === 0) {
    return [
      {
        id: "cpu-fallback",
        label: "CPU / unsupported",
        vendor: "Unknown",
        memoryKind: "host",
        budgetGb: 0,
        details: "No compatible accelerator detected.",
      },
    ];
  }

  return summary.system.gpus.map((gpu, index) => ({
    id: gpu.id ?? `${gpu.vendor}-${index}`,
    label: gpu.name,
    vendor: gpu.vendor,
    memoryKind: gpu.memory_kind ?? "discrete",
    budgetGb: gpu.vram_gb,
    details:
      gpu.memory_kind === "unified"
        ? `${gpu.vram_gb.toFixed(0)} GB recommended unified-memory budget`
        : `${gpu.vram_gb.toFixed(0)} GB VRAM`,
  }));
}

export function getRuntimeOptions(summary: NipuxSummary, device: DeviceOption | null): RuntimeProfile[] {
  if (!device) return summary.runtime_catalog;
  if (device.vendor === "Apple") {
    return summary.runtime_catalog.filter((runtime) => runtime.supports_apple);
  }
  return summary.runtime_catalog;
}

export function getModelOptions(
  summary: NipuxSummary,
  runtimeId: string,
  memoryBudgetGb: number,
): ModelSummary[] {
  return summary.model_catalog
    .filter((model) => model.runtime === runtimeId)
    .filter((model) => memoryBudgetGb >= model.min_vram_gb && summary.system.ram_gb >= model.target_ram_gb)
    .sort((left, right) => left.min_vram_gb - right.min_vram_gb);
}

export function getRecommendedModel(
  summary: NipuxSummary,
  runtimeId: string,
  memoryBudgetGb: number,
): ModelSummary | null {
  const options = getModelOptions(summary, runtimeId, memoryBudgetGb);
  return options.at(-1) ?? null;
}

export function getRecommendedRuntime(summary: NipuxSummary, device: DeviceOption | null): string {
  if (!device) return summary.runtime.id;
  if (device.vendor === "Apple") return "mlx";
  return summary.runtime.id;
}

export function formatDeviceMeta(gpu: GpuInfo): string {
  if (gpu.memory_kind === "unified") {
    return `${gpu.vram_gb.toFixed(0)} GB usable unified memory`;
  }
  return `${gpu.vram_gb.toFixed(0)} GB VRAM`;
}

