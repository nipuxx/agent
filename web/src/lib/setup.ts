import type { NipuxSettings } from "./types";

export function isSetupComplete(settings: NipuxSettings): boolean {
  if (settings.setup_completed) {
    return true;
  }

  if (settings.provider_mode === "external") {
    return Boolean(settings.openai_base_url.trim() && settings.openai_model.trim());
  }

  if (!(settings.preferred_runtime_id || "").trim()) {
    return false;
  }

  if (settings.custom_model_enabled) {
    return Boolean((settings.custom_model_repo || "").trim());
  }

  return Boolean((settings.preferred_model_id || "").trim());
}
