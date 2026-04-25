"use client";

import { AppShell } from "./app-shell";
import { SettingsPanel } from "./settings-panel";

export function SettingsView() {
  return (
    <AppShell>
      <SettingsPanel />
    </AppShell>
  );
}
