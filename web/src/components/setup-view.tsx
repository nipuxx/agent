"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "./app-shell";
import { RuntimeSetupPanel } from "./runtime-setup-panel";
import { useLiveSummary } from "@/lib/use-live-summary";

function panelLabel(label: string) {
  return (
    <div className="nipux-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
      {label}
    </div>
  );
}

export function SetupView() {
  const router = useRouter();
  const { summary, loading, error, refresh } = useLiveSummary();

  if (loading && !summary) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          Booting Nipux...
        </div>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-52px)] items-center justify-center px-6 text-[14px] text-[var(--muted-foreground)]">
          {error ?? "Setup is unavailable."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="grid h-[calc(100vh-52px)] min-h-0 min-w-0 overflow-hidden grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] border-r border-[var(--border)]">
          <header className="border-b border-[var(--border)] px-5 py-5 md:px-6">
            {panelLabel("setup")}
            <h1 className="mt-3 text-[30px] font-medium tracking-[-0.06em] text-[var(--foreground)]">
              First-run setup
            </h1>
            <p className="mt-3 max-w-[720px] text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
              Pick the runtime, pick the model, or paste a Hugging Face link for a custom install.
              Save it once here, then the rest of the app stays on Dashboard and Agents.
            </p>
          </header>

          <div className="min-h-0 overflow-auto">
            <RuntimeSetupPanel
              summary={summary}
              refresh={refresh}
              mode="setup"
              onComplete={() => router.push("/dashboard")}
            />
          </div>
        </main>

        <aside className="min-h-0 overflow-auto px-5 py-5 md:px-6">
          {panelLabel("how it works")}
          <div className="mt-4 space-y-4 text-[14px] leading-[1.8] text-[var(--muted-foreground)]">
            <p>1. Choose local runtime or external endpoint.</p>
            <p>2. Pick a recommended model or paste a Hugging Face link.</p>
            <p>3. Install or save the plan, then continue to Dashboard.</p>
            <p>4. Create agents in Agents and give them actual work.</p>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
