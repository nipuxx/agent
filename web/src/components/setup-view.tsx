"use client";

import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { RuntimeSetupPanel } from "./runtime-setup-panel";
import { useLiveSummary } from "@/lib/use-live-summary";
import { Badge } from "@/components/ui/badge";

function panelLabel(label: string) {
  return (
    <div className="nipux-label">
      {label}
    </div>
  );
}

const STEPS = [
  "Choose the interface theme",
  "Choose how Nipux reaches a model",
  "Choose the runtime and model",
  "Install, start, and enter the workspace",
];

export function SetupView() {
  const router = useRouter();
  const { summary, loading, error, refresh } = useLiveSummary();

  if (loading && !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-[14px] text-[var(--muted-foreground)]">
        Booting setup…
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-[14px] text-[var(--muted-foreground)]">
        {error ?? "Setup is unavailable."}
      </div>
    );
  }

  return (
    <div className="nipux-app min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col p-[var(--page-padding)]">
        <header className="nipux-panel flex items-center justify-between px-[var(--panel-padding)] py-4">
          <div>
            {panelLabel("nipux setup")}
            <div className="nipux-title mt-3 text-[30px] text-[var(--foreground)] md:text-[42px]">
              Bring the runtime online.
            </div>
          </div>

          <div className="flex items-center gap-3">
            {summary.settings.setup_completed ? (
              <Badge variant="success">configured</Badge>
            ) : (
              <Badge variant="secondary">first run</Badge>
            )}
            {summary.settings.setup_completed ? (
              <Link
                href="/dashboard"
                className="inline-flex h-[var(--control-height)] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] px-[var(--control-padding-x)] text-[13px] text-[var(--foreground)] transition-colors hover:border-[var(--border-strong)]"
              >
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </header>

        <div className="mt-5 grid min-h-0 flex-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="nipux-panel flex min-h-[320px] flex-col justify-between p-[var(--panel-padding)]">
            <div>
              {panelLabel("flow")}
              <div className="mt-6 space-y-4">
                {STEPS.map((step, index) => (
                  <div key={step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] text-[12px] text-[var(--foreground)]">
                        {index + 1}
                      </div>
                      {index < STEPS.length - 1 ? (
                        <div className="mt-2 h-8 w-px bg-[var(--border)]" />
                      ) : null}
                    </div>
                    <div className="pt-1 text-[14px] leading-[1.7] text-[var(--muted-foreground)]">{step}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="nipux-card p-[var(--card-padding)]">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-[var(--foreground)]" />
                <div className="text-[14px] text-[var(--foreground)]">Recommended today</div>
              </div>
              <div className="mt-3 text-[13px] leading-[1.7] text-[var(--muted-foreground)]">
                Carnice stays the default local recommendation. If you need something else, paste a Hugging Face repo
                or file link and Nipux will install that instead.
              </div>
            </div>
          </aside>

          <main className="nipux-frame min-h-[620px]">
            <RuntimeSetupPanel
              summary={summary}
              refresh={refresh}
              onComplete={() => router.push("/dashboard")}
            />
          </main>
        </div>

        <footer className="nipux-panel mt-5 flex items-center justify-between px-[var(--panel-padding)] py-4 text-[12px] text-[var(--muted-foreground)]">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5" />
            Setup is the only place that installs or starts a runtime.
          </div>
          <div className="nipux-label">
            Configure once, then work from Dashboard, Chats, and Agents.
          </div>
        </footer>
      </div>
    </div>
  );
}
