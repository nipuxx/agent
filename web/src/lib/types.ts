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

export interface TelemetrySummary {
  cpu_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  node_count: number;
  active_nodes: number;
  active_sessions: number;
  total_sessions: number;
  total_tokens: number;
  total_throughput_tps: number;
}

export interface HermesStatusSummary {
  installed: boolean;
  configured: boolean;
  version?: string | null;
  binary?: string | null;
  home: string;
  config_path: string;
  env_path: string;
  state_db_path: string;
  logs_path: string;
  gateway_running: boolean;
  install_command: string;
}

export interface HermesSettingsSummary {
  installed: boolean;
  configured: boolean;
  binary?: string | null;
  home: string;
  config_path: string;
  env_path: string;
  model: string;
  toolsets: string[];
  max_turns: number;
  terminal_backend: string;
  terminal_cwd: string;
  compression_enabled: boolean;
  compression_threshold: number;
  display_personality: string;
  openai_base_url: string;
  openrouter_api_key_set: boolean;
  openrouter_api_key_hint: string;
  openai_api_key_set: boolean;
  openai_api_key_hint: string;
}

export interface RuntimeStateSummary {
  status: string;
  model_loaded: boolean;
  active_model_id?: string | null;
  recommended_model_id?: string | null;
  endpoint?: string | null;
  started_at?: number | null;
}

export interface NodeSummary {
  id: string;
  identifier: string;
  label: string;
  status: string;
  mode: string;
  model: string;
  latency_ms: number;
  tokens_per_sec: number;
  total_tokens: number;
  uptime_seconds: number;
  description: string;
  trend: number[];
}

export interface UsageSummary {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  requests: number;
  tool_calls: number;
  api_equivalent_cost_usd?: number | null;
  savings_vs_api_usd?: number | null;
}

export interface ApiReferencePricing {
  provider: string;
  model_id: string;
  label: string;
  prompt_per_million_usd: number;
  completion_per_million_usd: number;
  blended_per_million_usd: number;
  context_length?: number | null;
  source_url: string;
  checked_at?: number | null;
}

export interface NipuxSummary {
  product: string;
  system: SystemSummary;
  telemetry: TelemetrySummary;
  hermes: HermesStatusSummary;
  settings: HermesSettingsSummary;
  runtime_state: RuntimeStateSummary;
  nodes: NodeSummary[];
  log_lines: string[];
  usage_summary: UsageSummary;
  api_reference?: ApiReferencePricing | null;
  agents: Array<{
    id: string;
    label: string;
    description: string;
    mode: string;
    status: string;
    started_at?: number | null;
    uptime_seconds: number;
  }>;
}

export interface HermesSettingsUpdate {
  model?: string;
  toolsets?: string[] | string;
  max_turns?: number;
  terminal_backend?: string;
  terminal_cwd?: string;
  compression_enabled?: boolean;
  compression_threshold?: number;
  display_personality?: string;
  openai_base_url?: string;
  openrouter_api_key?: string;
  openai_api_key?: string;
}
