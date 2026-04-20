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

export interface RuntimeStateSummary {
  runtime_id?: string | null;
  status: string;
  model_loaded: boolean;
  active_model_id?: string | null;
  recommended_model_id?: string | null;
  endpoint?: string | null;
  model_path?: string | null;
  started_at?: number | null;
  install_task_id?: string | null;
  pid?: number | null;
  health?: Record<string, unknown>;
  last_health?: Record<string, unknown>;
  last_error?: string | null;
}

export interface RuntimeModel {
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

export interface RuntimeRecommendation {
  supported: boolean;
  selected_model_id?: string | null;
  selected?: RuntimeModel | null;
  effective_vram_gb?: number;
  estimated_tokens_per_second?: number;
  estimated_cost_per_million_tokens_usd?: number;
  reason: string;
  platform_track?: string | null;
}

export interface RuntimePlan {
  system: SystemSummary;
  recommendation: RuntimeRecommendation;
  runtime: {
    id: string;
    label: string;
    reason: string;
  };
  runtime_profile?: {
    id: string;
    label: string;
    best_for: string;
    install_size_gb: number;
    network_exposed: boolean;
    supports_apple: boolean;
  } | null;
  model?: RuntimeModel | null;
  runtime_options?: Array<{
    id: string;
    label: string;
    best_for: string;
    install_size_gb: number;
    network_exposed: boolean;
    supports_apple: boolean;
  }>;
  model_options?: RuntimeModel[];
  install_plan: {
    estimated_disk_needed_gb: number;
    requires_confirmation: boolean;
    warnings: string[];
    steps: string[];
    blocked: boolean;
    capability_reason?: string | null;
  };
}

export interface NipuxSettings {
  provider_mode: string;
  openai_base_url: string;
  openai_api_key?: string;
  openai_model: string;
  worker_action_budget: number;
  checkpoint_every_actions: number;
  max_runtime_minutes: number;
  browser_headless: boolean;
  browser_viewport: { width: number; height: number };
  workspace_root: string;
  allow_terminal: boolean;
  allow_browser: boolean;
  allow_file_tools: boolean;
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
  browser_session_id?: string | null;
  browser_url?: string | null;
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

export interface AgentRecord {
  id: string;
  name: string;
  label: string;
  description: string;
  system_prompt: string;
  toolsets: string[];
  model_policy: Record<string, unknown>;
  runtime_policy: Record<string, unknown>;
  hermes_overrides: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  last_session_id?: string | null;
  status: string;
}

export interface ThreadRecord {
  id: string;
  agent_id: string;
  title: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  session_id?: string | null;
  role: string;
  kind: string;
  label: string;
  body: string;
  created_at: number;
}

export interface ThreadBundle {
  thread: ThreadRecord;
  messages: ThreadMessage[];
}

export interface InstallTask {
  id: string;
  kind: string;
  runtime_id?: string | null;
  status: string;
  plan: RuntimePlan;
  detail: {
    logs?: string[];
    [key: string]: unknown;
  };
  created_at: number;
  updated_at: number;
}

export interface NipuxEvent {
  id: number;
  stream_type: string;
  stream_id: string;
  event_type: string;
  level: string;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface BrowserSession {
  id: string;
  agent_id: string;
  status: string;
  control_mode: string;
  current_url: string;
  title: string;
  last_frame_path?: string | null;
  created_at: number;
  updated_at: number;
  frame_path?: string;
  excerpt?: string;
  url?: string;
  captured_at?: number;
}

export interface RunRecord {
  id: string;
  thread_id: string;
  agent_id: string;
  goal: string;
  status: string;
  success_criteria: Record<string, unknown>;
  budget: Record<string, unknown>;
  top_task_id?: string | null;
  current_checkpoint_id?: string | null;
  report: Record<string, unknown>;
  started_at?: number | null;
  ended_at?: number | null;
  created_at: number;
  updated_at: number;
  last_error?: string | null;
}

export interface TaskNode {
  id: string;
  run_id: string;
  parent_id?: string | null;
  kind: string;
  title: string;
  objective: string;
  inputs: Record<string, unknown>;
  constraints: Record<string, unknown>;
  verifier: Record<string, unknown>;
  budget: Record<string, unknown>;
  status: string;
  assigned_agent_id?: string | null;
  attempt_count: number;
  created_at: number;
  updated_at: number;
}

export interface NipuxSummary {
  product: string;
  system: SystemSummary;
  telemetry: TelemetrySummary;
  settings: NipuxSettings;
  runtime_state: RuntimeStateSummary;
  runtime_plan: RuntimePlan;
  nodes: NodeSummary[];
  log_lines: string[];
  usage_summary: UsageSummary;
  agents: AgentRecord[];
  runs: RunRecord[];
}

export interface SettingsUpdate {
  provider_mode?: string;
  openai_base_url?: string;
  openai_api_key?: string;
  openai_model?: string;
  worker_action_budget?: number;
  checkpoint_every_actions?: number;
  max_runtime_minutes?: number;
  browser_headless?: boolean;
  workspace_root?: string;
  allow_terminal?: boolean;
  allow_browser?: boolean;
  allow_file_tools?: boolean;
  preferred_runtime_id?: string;
  preferred_model_id?: string;
}
