"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, History, LayoutGrid, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import type { TelemetrySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Control", icon: LayoutGrid },
  { href: "/chat", label: "Focus", icon: BarChart3 },
  { href: "/agents", label: "Nodes", icon: Boxes },
  { href: "/settings", label: "History", icon: History },
];

function TelemetryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
      <span>{label}:</span>
      <span className="text-[var(--foreground)]">{value}</span>
    </div>
  );
}

export function AppShell({
  children,
  telemetry,
}: {
  children: ReactNode;
  telemetry?: TelemetrySummary | null;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen grid-cols-[68px_minmax(0,1fr)]">
        <aside className="relative flex flex-col border-r border-[var(--border)] bg-[var(--rail)]">
          <div className="absolute inset-y-0 left-0 w-[3px] bg-[#6d5efc]" />
          <div className="flex h-[66px] items-center justify-center border-b border-[var(--border)]">
            <div className="nipux-mono text-[18px] uppercase tracking-[0.16em]">A_01</div>
          </div>

          <nav className="flex flex-1 flex-col items-center gap-7 py-6">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center border transition-colors",
                    active
                      ? "border-white bg-white text-black"
                      : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]",
                  )}
                >
                  {active ? <span className="absolute -left-[17px] inset-y-0 w-[3px] bg-[#6d5efc]" /> : null}
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </Link>
              );
            })}
          </nav>

          <div className="flex justify-center border-t border-[var(--border)] py-6">
            <Link
              href="/settings"
              title="Settings"
              className={cn(
                "relative flex h-12 w-12 items-center justify-center border transition-colors",
                pathname === "/settings"
                  ? "border-white bg-white text-black"
                  : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]",
              )}
            >
              {pathname === "/settings" ? <span className="absolute -left-[17px] inset-y-0 w-[3px] bg-[#6d5efc]" /> : null}
              <Settings2 className="h-5 w-5" strokeWidth={1.7} />
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="flex min-h-[52px] items-center justify-between border-b border-[var(--border)] px-7 py-2">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3">
                <Image src="/nipux-logo.png" alt="Nipux" width={18} height={18} className="h-[18px] w-[18px]" />
                <div className="nipux-display text-[36px] uppercase leading-none tracking-[0.03em]">
                  NIPUX_OS
                </div>
              </div>

              {telemetry ? (
                <div className="hidden items-center gap-7 lg:flex">
                  <TelemetryItem label="CPU" value={`${telemetry.cpu_percent.toFixed(1)}%`} />
                  <TelemetryItem label="RAM" value={`${telemetry.ram_used_gb.toFixed(1)}GB`} />
                  <TelemetryItem label="Nodes" value={String(telemetry.node_count).padStart(2, "0")} />
                  <TelemetryItem label="Sessions" value={String(telemetry.active_sessions).padStart(2, "0")} />
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-5 nipux-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              <span>⌲</span>
              <span>(◌)</span>
            </div>
          </header>

          <main className="p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
