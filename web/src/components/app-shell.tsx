"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronRight,
  Cpu,
  LayoutDashboard,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/setup", label: "Setup", icon: Settings2 },
  { href: "/chat", label: "Chat", icon: Sparkles },
  { href: "/agents", label: "Agents", icon: Bot },
];

export function AppShell({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen text-[var(--fg)]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-r border-white/8 bg-black/10 px-4 py-5 backdrop-blur-xl">
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/4 px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-black shadow-lg shadow-black/30">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Nipux</div>
              <div className="text-xs text-[var(--dim)]">Hermes Control Plane</div>
            </div>
          </div>

          <nav className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                    active
                      ? "bg-white/8 text-white"
                      : "text-[var(--dim)] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {active ? <ChevronRight className="ml-auto h-4 w-4 opacity-70" /> : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-[var(--border)] bg-white/4 p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--dim)]">
              Design Notes
            </div>
            <p className="text-sm leading-6 text-[var(--dim)]">
              Nipux owns the install flow, runtime selection, and Hermes boundary. The UI only speaks
              to `nipuxd`.
            </p>
          </div>
        </aside>

        <main className="nipux-grid min-w-0 px-5 py-5 sm:px-8">
          <header className="mb-6 flex flex-col gap-3 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--dim)]">
                {kicker}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            </div>
            <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/5 px-3 py-1 text-xs text-[var(--dim)]">
              Built to keep Hermes replaceable and the UI stable.
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

