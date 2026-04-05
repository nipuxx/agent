from __future__ import annotations

from typing import Iterable

from .catalog import MODEL_CATALOG, RUNTIME_PROFILES


def choose_runtime(system: dict, selected_model: dict | None = None) -> dict:
    gpus = system["gpus"]
    gpu_list = list(gpus)
    if selected_model is not None:
        runtime_id = selected_model["runtime"]
        runtime_row = next((row for row in RUNTIME_PROFILES if row["id"] == runtime_id), None)
        if runtime_row:
            return {
                "id": runtime_row["id"],
                "label": runtime_row["label"],
                "reason": f"{selected_model['family']} {selected_model['size']} {selected_model['quantization']} is packaged for {runtime_row['label']}.",
            }

    if system.get("apple_silicon"):
        return {
            "id": "mlx",
            "label": "MLX",
            "reason": "Apple Silicon detected. Prefer MLX for unified-memory local inference.",
        }

    if not gpu_list:
        return {
            "id": "llama.cpp",
            "label": "llama.cpp",
            "reason": "No compatible GPU detected. Prefer the broadest local runtime.",
        }

    vendors = {gpu["vendor"] for gpu in gpu_list}
    total_vram = sum(gpu.get("vram_gb", 0.0) or 0.0 for gpu in gpu_list)
    max_bandwidth = max((gpu.get("memory_bandwidth_gbps") or 0.0) for gpu in gpu_list)

    if "NVIDIA" in vendors and total_vram >= 48:
        return {
            "id": "vllm",
            "label": "vLLM",
            "reason": f"NVIDIA detected with {total_vram:.0f} GB usable VRAM. Prefer vLLM for larger non-GGUF serving paths.",
        }
    if "AMD" in vendors and total_vram >= 48 and max_bandwidth >= 700:
        return {
            "id": "vllm",
            "label": "vLLM",
            "reason": "High-bandwidth AMD hardware detected. vLLM is viable for larger non-GGUF serving paths.",
        }
    return {
        "id": "llama.cpp",
        "label": "llama.cpp",
        "reason": "Prefer GGUF compatibility and simpler local serving for this hardware tier.",
    }


def choose_model(system: dict) -> dict:
    gpu_list = list(system["gpus"])
    system_ram_gb = system["ram_gb"]
    apple_silicon = system.get("apple_silicon", False)
    total_vram = sum(gpu.get("vram_gb", 0.0) or 0.0 for gpu in gpu_list)
    max_bandwidth = max((gpu.get("memory_bandwidth_gbps") or 0.0) for gpu in gpu_list) if gpu_list else 0.0
    usable_vram = total_vram if len(gpu_list) > 1 else max((gpu.get("vram_gb", 0.0) for gpu in gpu_list), default=0.0)

    if apple_silicon:
        catalog = [item for item in MODEL_CATALOG if item["runtime"] == "mlx"]
        usable_vram = max((gpu.get("vram_gb", 0.0) for gpu in gpu_list if gpu.get("vendor") == "Apple"), default=usable_vram)
    else:
        catalog = [item for item in MODEL_CATALOG if item["runtime"] == "llama.cpp"]

    if not apple_silicon and max_bandwidth and max_bandwidth < 260 and usable_vram >= 24:
        usable_vram = min(usable_vram, 16.0)

    selected = None
    for item in catalog:
        if usable_vram >= item["min_vram_gb"] and system_ram_gb >= item["target_ram_gb"]:
            selected = item

    if selected is None:
        return {
            "supported": False,
            "reason": (
                "Carnice requires enough usable GPU or unified memory for the selected quantization."
                if apple_silicon
                else "Carnice requires at least 8 GB of usable VRAM and enough system RAM for the selected quantization."
            ),
            "selected_model_id": None,
            "effective_vram_gb": usable_vram,
            "platform_track": "mlx" if apple_silicon else "gguf",
        }

    estimated_tps = estimate_tokens_per_second(selected, usable_vram, max_bandwidth)
    effective_cost = estimate_cost_per_million_tokens(selected, estimated_tps)

    return {
        "supported": True,
        "selected_model_id": selected["id"],
        "selected": selected,
        "effective_vram_gb": usable_vram,
        "estimated_tokens_per_second": estimated_tps,
        "estimated_cost_per_million_tokens_usd": effective_cost,
        "reason": f"Selected {selected['family']} {selected['size']} {selected['quantization']} for {usable_vram:.0f} GB usable VRAM.",
        "platform_track": "mlx" if apple_silicon else "gguf",
    }


def estimate_tokens_per_second(model: dict, usable_vram_gb: float, bandwidth_gbps: float | None) -> float:
    base = {
        "carnice-9b-mlx-4bit": 34.0,
        "carnice-9b-mlx-8bit": 22.0,
        "carnice-27b-mlx-4bit": 12.0,
        "carnice-27b-mlx-8bit": 7.0,
        "carnice-9b-q4km": 92.0,
        "carnice-9b-q6": 68.0,
        "carnice-9b-q8": 54.0,
        "carnice-27b-q4km": 30.0,
        "carnice-27b-q6": 23.0,
        "carnice-27b-q8": 18.0,
    }[model["id"]]
    bandwidth_factor = 1.0
    if bandwidth_gbps:
        bandwidth_factor = max(0.75, min(1.6, bandwidth_gbps / 900.0))
    vram_factor = max(0.9, min(1.2, usable_vram_gb / max(model["min_vram_gb"], 1.0)))
    return round(base * bandwidth_factor * vram_factor, 1)


def estimate_cost_per_million_tokens(model: dict, estimated_tps: float) -> float:
    power_hint = 280.0 if model["size"] == "27B" else 180.0
    seconds = 1_000_000.0 / max(estimated_tps, 1.0)
    kwh = (power_hint / 1000.0) * (seconds / 3600.0)
    return round(kwh * 0.15, 2)


def build_install_plan(system: dict, recommendation: dict, runtime: dict, hermes: dict) -> dict:
    install_size = 0.0
    runtime_row = next((row for row in RUNTIME_PROFILES if row["id"] == runtime["id"]), None)
    if runtime_row:
        install_size += runtime_row["install_size_gb"]
    selected = recommendation.get("selected")
    if selected:
        install_size += selected["target_vram_gb"]

    warnings: list[str] = []
    if not hermes["installed"]:
        warnings.append("Hermes Agent is not installed yet and will need to be bootstrapped.")
    if recommendation.get("supported") is False:
        warnings.append("This host does not currently meet the minimum Carnice footprint.")
    if system["disk_free_gb"] < install_size + 10:
        warnings.append("Free disk space is tight for the chosen runtime and model payload.")

    return {
        "estimated_disk_needed_gb": round(install_size, 1),
        "requires_confirmation": True,
        "warnings": warnings,
        "steps": [
            "Wait for the user to confirm the plan inside the Nipux onboarding flow.",
            "Create a Nipux-managed Hermes home and profile directory.",
            f"Install or validate the {runtime['label']} runtime.",
            "Download the recommended Carnice build.",
            "Generate a Nipux-owned Hermes config that targets the local model endpoint.",
            "Expose the Nipux UI on the local network and keep Hermes behind the daemon boundary.",
        ],
    }
