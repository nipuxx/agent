import type { NipuxSettings } from "./types";

export function isSetupComplete(settings: NipuxSettings): boolean {
  return Boolean(settings.setup_completed);
}
