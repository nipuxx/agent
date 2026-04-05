"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LayoutDashboard, MessageSquare, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/setup", label: "Configs", icon: Settings2 },
  { href: "/agents", label: "Agents", icon: Bot },
];

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-r border-[var(--border)] bg-[var(--sidebar)]">
          <div className="flex h-16 items-center border-b border-[var(--border)] px-5">
            <div>
              <div className="text-sm font-semibold tracking-tight">Nipux</div>
              <div className="text-xs text-[var(--muted-foreground)]">Hermes local control plane</div>
            </div>
          </div>

          <nav className="space-y-1 p-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <header className="border-b border-[var(--border)] px-6 py-5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{subtitle}</p>
            ) : null}
          </header>
          <div className="px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
