"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, MessagesSquare, PanelsTopLeft, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SettingsPanel } from "./settings-panel";
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
        "flex h-[var(--rail-icon-size)] w-[var(--rail-icon-size)] items-center justify-center rounded-[var(--radius-control)] border text-[var(--muted-foreground)] transition-colors",
        active
          ? "border-[var(--border)] bg-[var(--active-surface)] text-[var(--foreground)]"
          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--hover-surface)] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </Link>
  );
}

function RailButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof LayoutGrid;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-[var(--rail-icon-size)] w-[var(--rail-icon-size)] items-center justify-center rounded-[var(--radius-control)] border text-[var(--muted-foreground)] transition-colors",
        active
          ? "border-[var(--border)] bg-[var(--active-surface)] text-[var(--foreground)]"
          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--hover-surface)] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </button>
  );
}

export function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen]);

  return (
    <div className="nipux-app min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen" style={{ gridTemplateColumns: "var(--rail-width) minmax(0, 1fr)" }}>
        <aside className="relative flex flex-col border-r border-[var(--border)] bg-[var(--rail)]">
          <div className="absolute inset-y-0 left-0 w-px bg-[var(--rail-stripe)]" />

          <div className="flex h-[calc(var(--rail-width)_-_8px)] min-h-[52px] items-center justify-center border-b border-[var(--border)]">
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
              <RailButton
                active={settingsOpen || pathname === "/settings"}
                label="Settings"
                icon={Settings2}
                onClick={() => setSettingsOpen(true)}
              />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <main className="h-screen overflow-hidden">{children}</main>
        </div>
      </div>
      {settingsOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/58 px-4 py-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Nipux settings">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative h-[min(780px,92dvh)] w-[min(1040px,94vw)] overflow-hidden rounded-[var(--radius-frame)] border border-[var(--border)] bg-[var(--background)] shadow-[var(--panel-shadow)]">
            <SettingsPanel modal onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
