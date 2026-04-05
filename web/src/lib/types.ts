export interface GpuInfo {
  id?: string;
  vendor: string;
  name: string;
  vram_gb: number;
  memory_bandwidth_gbps?: number | null;
  driver?: string | null;
  power_limit_watts?: number | null;
  memory_kind?: string | null;
  shared_memory_gb?: number | null;
}

export interface SystemSummary {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  chip_name?: string | null;
  apple_silicon?: boolean;
  cpu_model: string;
  cpu_cores_logical: number;
  cpu_cores_physical: number;
  ram_gb: number;
  disk_free_gb: number;
  disk_total_gb: number;
  gpus: GpuInfo[];
}

export interface RuntimeSummary {
  id: string;
  label: string;
  reason: string;
}

export interface ModelSummary {
  id: string;
  family: string;
  size: string;
  quantization: string;
  runtime: string;
  artifact_kind: string;
  min_vram_gb: number;
  target_vram_gb: number;
  target_ram_gb: number;
  repo: string;
  filename: string;
  notes: string;
}

export interface RecommendationSummary {
  supported: boolean;
  selected_model_id?: string | null;
  selected?: ModelSummary;
  effective_vram_gb: number;
  estimated_tokens_per_second?: number;
  estimated_cost_per_million_tokens_usd?: number;
  reason: string;
  platform_track?: string;
}

export interface HermesSummary {
  installed: boolean;
  version?: string | null;
  binary?: string | null;
  managed_home: string;
  managed_profile: string;
  strategy: string;
  environment: Record<string, string>;
}

export interface InstallPlan {
  estimated_disk_needed_gb: number;
  requires_confirmation?: boolean;
  warnings: string[];
  steps: string[];
}

export interface RuntimeProfile {
  id: string;
  label: string;
  best_for: string;
  install_size_gb: number;
  network_exposed: boolean;
  supports_apple?: boolean;
}

export interface NipuxSummary {
  product: string;
  system: SystemSummary;
  hermes: HermesSummary;
  runtime: RuntimeSummary;
  recommendation: RecommendationSummary;
  install_plan: InstallPlan;
  model_catalog: ModelSummary[];
  runtime_catalog: RuntimeProfile[];
}
