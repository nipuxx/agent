from __future__ import annotations

import json
import platform
import re
import shutil
import socket
import subprocess
from pathlib import Path

import psutil


BANDWIDTH_HINTS = {
    "RTX 4090": 1008,
    "RTX 3090": 936,
    "RTX 3080": 760,
    "RTX 3070": 448,
    "A10": 600,
    "A100": 1935,
    "H100": 2039,
    "GH200": 4900,
    "L40S": 864,
    "L4": 300,
    "MI300": 5000,
    "MI250": 3277,
    "MI210": 1638,
    "RX 7900": 960,
    "Arc A770": 560,
}


def run_command(args: list[str], timeout: int = 8) -> str:
    try:
        result = subprocess.run(
            args,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except Exception:
        return ""
    if result.returncode != 0 and not result.stdout and not result.stderr:
        return ""
    return (result.stdout or result.stderr).strip()


def lookup_bandwidth(name: str) -> float | None:
    for key, value in BANDWIDTH_HINTS.items():
        if key.lower() in name.lower():
            return float(value)
    return None


def detect_nvidia() -> list[dict]:
    nvidia_smi = shutil.which("nvidia-smi")
    if not nvidia_smi:
        return []

    raw = run_command(
        [
            nvidia_smi,
            "--query-gpu=name,memory.total,driver_version,power.limit",
            "--format=csv,noheader,nounits",
        ]
    )
    rows = []
    for line in raw.splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 4:
            continue
        name, memory_mb, driver_version, power_limit = parts[:4]
        rows.append(
            {
                "vendor": "NVIDIA",
                "name": name,
                "vram_gb": round(float(memory_mb) / 1024.0, 1),
                "memory_bandwidth_gbps": lookup_bandwidth(name),
                "driver": driver_version,
                "power_limit_watts": float(power_limit) if power_limit else None,
            }
        )
    return rows


def detect_amd() -> list[dict]:
    rocm_smi = shutil.which("rocm-smi")
    if not rocm_smi:
        return []
    raw = run_command([rocm_smi, "--showproductname", "--showmeminfo", "vram", "--json"])
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return []

    rows = []
    for _, data in payload.items():
        name = str(data.get("Card series") or data.get("Card SKU") or "AMD GPU")
        mem_bytes = 0
        for key, value in data.items():
            if "VRAM Total Memory" in key:
                match = re.search(r"([0-9]+)", str(value))
                if match:
                    mem_bytes = int(match.group(1))
                    break
        rows.append(
            {
                "vendor": "AMD",
                "name": name,
                "vram_gb": round(mem_bytes / (1024 ** 3), 1) if mem_bytes else 0.0,
                "memory_bandwidth_gbps": lookup_bandwidth(name),
                "driver": None,
                "power_limit_watts": None,
            }
        )
    return rows


def detect_intel() -> list[dict]:
    lspci = shutil.which("lspci")
    if not lspci:
        return []
    raw = run_command([lspci])
    rows = []
    for line in raw.splitlines():
        lower = line.lower()
        if "intel" in lower and ("vga" in lower or "display" in lower or "3d controller" in lower):
            rows.append(
                {
                    "vendor": "Intel",
                    "name": line.split(": ", 1)[-1],
                    "vram_gb": 0.0,
                    "memory_bandwidth_gbps": lookup_bandwidth(line),
                    "driver": None,
                    "power_limit_watts": None,
                }
            )
    return rows


def detect_system() -> dict:
    disk = shutil.disk_usage(str(Path.home()))
    hostname = socket.gethostname()
    ram_gb = round(psutil.virtual_memory().total / (1024 ** 3), 1)

    return {
        "hostname": hostname,
        "platform": platform.system(),
        "release": platform.release(),
        "arch": platform.machine(),
        "cpu_model": platform.processor() or platform.machine(),
        "cpu_cores_logical": psutil.cpu_count(logical=True) or 0,
        "cpu_cores_physical": psutil.cpu_count(logical=False) or 0,
        "ram_gb": ram_gb,
        "disk_free_gb": round(disk.free / (1024 ** 3), 1),
        "disk_total_gb": round(disk.total / (1024 ** 3), 1),
        "gpus": detect_nvidia() + detect_amd() + detect_intel(),
    }

