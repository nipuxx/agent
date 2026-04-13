"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutGrid, MessageSquareText, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import type { TelemetrySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Control", icon: LayoutGrid },
  { href: "/chat", label: "Console", icon: MessageSquareText },
  { href: "/agents", label: "Nodes", icon: Boxes },
  { href: "/settings", label: "Settings", icon: Settings2 },
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
      <div className="grid min-h-screen grid-cols-[72px_minmax(0,1fr)]">
        <aside className="flex flex-col border-r border-[var(--border)] bg-[var(--rail)]">
          <div className="flex h-[72px] items-center justify-center border-b border-[var(--border)]">
            <div className="nipux-mono text-[18px] uppercase tracking-[0.16em]">A_01</div>
          </div>

          <nav className="flex flex-1 flex-col items-center gap-6 py-6">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center border transition-colors",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="flex h-[72px] items-center justify-between border-b border-[var(--border)] px-8">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3">
                <Image src="/nipux-logo.png" alt="Nipux" width={28} height={28} className="h-7 w-7" />
                <div className="nipux-display text-[42px] uppercase leading-none tracking-[0.04em]">
                  NIPUX_OS
                </div>
              </div>

              {telemetry ? (
                <div className="hidden items-center gap-8 lg:flex">
                  <TelemetryItem label="CPU" value={`${telemetry.cpu_percent.toFixed(1)}%`} />
                  <TelemetryItem label="RAM" value={`${telemetry.ram_used_gb.toFixed(1)}GB`} />
                  <TelemetryItem label="Nodes" value={String(telemetry.node_count).padStart(2, "0")} />
                  <TelemetryItem label="Sessions" value={String(telemetry.total_sessions).padStart(2, "0")} />
                </div>
              ) : null}
            </div>

            <div className="nipux-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
              LOCAL_SECURE
            </div>
          </header>

          <main className="p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
