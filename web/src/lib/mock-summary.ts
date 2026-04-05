import type { NipuxSummary } from "./types";

export const mockSummary: NipuxSummary = {
  product: "Nipux",
  system: {
    hostname: "local-workstation",
    platform: "Linux",
    release: "6.x",
    arch: "x86_64",
    cpu_model: "AMD Ryzen 9 / Apple Silicon / Xeon class host",
    cpu_cores_logical: 24,
    cpu_cores_physical: 12,
    ram_gb: 64,
    disk_free_gb: 714.2,
    disk_total_gb: 2048,
    gpus: [
      {
        vendor: "NVIDIA",
        name: "RTX 4090",
        vram_gb: 24,
        memory_bandwidth_gbps: 1008,
        driver: "driver detected at runtime",
        power_limit_watts: 450,
      },
    ],
  },
  hermes: {
    installed: false,
    version: null,
    binary: null,
    managed_home: "~/.local/share/nipux/hermes-home",
    managed_profile: "~/.local/share/nipux/hermes-home/profiles/nipux",
    strategy: "Subprocess boundary with Nipux-owned profile paths and config.",
    environment: {
      HERMES_HOME: "~/.local/share/nipux/hermes-home",
      HERMES_PROFILE: "nipux",
      NIPUX_MANAGED: "1",
      NIPUX_MODEL_ENDPOINT: "http://127.0.0.1:8000/v1",
    },
  },
  runtime: {
    id: "vllm",
    label: "vLLM",
    reason: "NVIDIA detected with enough VRAM for high-throughput local serving.",
  },
  recommendation: {
    supported: true,
    selected_model_id: "carnice-27b-q4km",
    effective_vram_gb: 24,
    estimated_tokens_per_second: 31.2,
    estimated_cost_per_million_tokens_usd: 0.37,
    reason: "Selected Carnice 27B Q4_K_M for 24 GB usable VRAM.",
    selected: {
      id: "carnice-27b-q4km",
      family: "Carnice",
      size: "27B",
      quantization: "Q4_K_M",
      runtime: "llama.cpp",
      min_vram_gb: 24,
      target_vram_gb: 16.8,
      target_ram_gb: 24,
      repo: "https://huggingface.co/kai-os/Carnice-27b-GGUF",
      filename: "Carnice-27b-Q4_K_M.gguf",
      notes: "27B entry point. Repo assumed to exist for planning.",
    },
  },
  install_plan: {
    estimated_disk_needed_gb: 24.3,
    warnings: [
      "Hermes Agent is not installed yet and will need to be bootstrapped.",
    ],
    steps: [
      "Create a Nipux-managed Hermes home and profile directory.",
      "Install or validate the vLLM runtime.",
      "Download the recommended Carnice build.",
      "Generate a Nipux-owned Hermes config that targets the local model endpoint.",
      "Expose the Nipux UI on the local network and keep Hermes behind the daemon boundary.",
    ],
  },
  model_catalog: [],
};

