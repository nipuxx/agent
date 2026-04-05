from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


def get_hermes_status() -> dict:
    hermes_bin = shutil.which("hermes")
    managed_home = Path.home() / ".local" / "share" / "nipux" / "hermes-home"
    managed_profile = managed_home / "profiles" / "nipux"

    version = None
    if hermes_bin:
        try:
            result = subprocess.run(
                [hermes_bin, "--version"],
                check=False,
                capture_output=True,
                text=True,
                timeout=8,
            )
            version = (result.stdout or result.stderr).strip() or None
        except Exception:
            version = None

    return {
        "installed": hermes_bin is not None,
        "version": version,
        "binary": hermes_bin,
        "managed_home": str(managed_home),
        "managed_profile": str(managed_profile),
        "strategy": "Subprocess boundary with Nipux-owned profile paths and config.",
        "environment": {
            "HERMES_HOME": str(managed_home),
            "HERMES_PROFILE": "nipux",
            "NIPUX_MANAGED": "1",
            "NIPUX_MODEL_ENDPOINT": os.environ.get("NIPUX_MODEL_ENDPOINT", "http://127.0.0.1:8000/v1"),
        },
    }

