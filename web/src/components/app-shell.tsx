"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, MessagesSquare, PanelsTopLeft, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/chat", label: "Chats", icon: MessagesSquare },
  { href: "/agents", label: "Agents", icon: PanelsTopLeft },
];

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
        "flex h-10 w-10 items-center justify-center border text-[var(--muted-foreground)] transition-colors",
        active
          ? "border-[var(--border)] bg-[var(--active-surface)] text-[var(--foreground)]"
          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--hover-surface)] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </Link>
  );
}

export function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen grid-cols-[60px_minmax(0,1fr)]">
        <aside className="relative flex flex-col border-r border-[var(--border)] bg-[var(--rail)]">
          <div className="absolute inset-y-0 left-0 w-px bg-[var(--rail-stripe)]" />

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

          <div className="border-t border-[var(--border)] py-5">
            <div className="flex items-center justify-center">
              <RailLink
                href="/settings"
                active={pathname === "/settings"}
                label="Settings"
                icon={Settings2}
              />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <main className="h-screen overflow-hidden">{children}</main>
        </div>
      </div>
    </div>
  );
}
