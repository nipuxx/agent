"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutGrid, MessageSquareText, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import type { TelemetrySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/chat", label: "Console", icon: MessageSquareText },
  { href: "/agents", label: "Agents", icon: Boxes },
];

function formatTelemetry(telemetry?: TelemetrySummary | null) {
  if (!telemetry) {
    return [];
  }

  return [
    { label: "CPU", value: `${Math.round(telemetry.cpu_percent)}%` },
    { label: "RAM", value: `${telemetry.ram_used_gb.toFixed(1)}GB` },
    { label: "NODES", value: String(telemetry.node_count).padStart(2, "0") },
  ];
}

function RailLink({
  href,
  active,
  label,
  icon: Icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: typeof LayoutGrid;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center border transition-colors duration-150",
        active
          ? "border-white/10 bg-white/[0.03] text-[var(--foreground)]"
          : "border-transparent text-[var(--muted-foreground)] hover:border-white/10 hover:bg-white/[0.025] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </Link>
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
  const telemetryItems = formatTelemetry(telemetry);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen grid-cols-[60px_minmax(0,1fr)]">
        <aside className="relative flex flex-col border-r border-[var(--border)] bg-black/20">
          <div className="absolute inset-y-0 left-0 w-px bg-[#5f56d9]" />

          <div className="flex h-[52px] items-center justify-center border-b border-[var(--border)]">
            <Image
              src="/nipux-logo.png"
              alt="Nipux"
              width={22}
              height={22}
              className="h-[22px] w-[22px] opacity-90"
            />
          </div>

          <nav className="flex flex-1 flex-col items-center gap-4 py-6">
            {NAV.map((item) => (
              <RailLink
                key={item.href}
                href={item.href}
                active={pathname === item.href}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </nav>

          <div className="flex items-center justify-center border-t border-[var(--border)] py-5">
            <RailLink
              href="/settings"
              active={pathname === "/settings"}
              label="Settings"
              icon={Settings2}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="flex h-[52px] items-center justify-between border-b border-[var(--border)] px-4 md:px-6">
            <div className="flex items-center gap-5">
              <div className="nipux-mono text-[15px] uppercase tracking-[0.02em] text-[var(--foreground)]">
                NIPUX_OS
              </div>

              {telemetryItems.length ? (
                <div className="hidden items-center gap-6 lg:flex">
                  {telemetryItems.map((item) => (
                    <div
                      key={item.label}
                      className="nipux-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]"
                    >
                      <span>{item.label}</span>
                      <span className="ml-2 text-[var(--foreground)]">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="nipux-mono flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--subtle-foreground)]">
              <span className="inline-block h-1.5 w-1.5 bg-[var(--foreground)]/70" />
              <span>READY</span>
            </div>
          </header>

          <main className="min-h-[calc(100vh-52px)]">{children}</main>
        </div>
      </div>
    </div>
  );
}
