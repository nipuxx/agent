"use client";

import { Check } from "lucide-react";

import { applyTheme, NIPUX_THEMES, themeById } from "@/lib/themes";

function MiniConsole({ themeId }: { themeId: string }) {
  const theme = themeById(themeId);
  return (
    <div
      className="h-[112px] border p-3"
      style={{
        background: theme.preview.background,
        borderColor: theme.preview.border,
        color: theme.preview.foreground,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="h-2 w-16" style={{ background: theme.preview.foreground, opacity: 0.8 }} />
        <div className="h-2 w-5" style={{ background: theme.preview.accent }} />
      </div>
      <div className="mt-4 grid grid-cols-[1fr_54px] gap-3">
        <div className="space-y-2">
          <div className="h-3 w-24" style={{ background: theme.preview.foreground }} />
          <div className="h-2 w-32" style={{ background: theme.preview.muted }} />
          <div className="h-2 w-20" style={{ background: theme.preview.muted }} />
        </div>
        <div className="h-14 border" style={{ borderColor: theme.preview.border, background: theme.preview.surface }} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-5 border"
            style={{
              borderColor: theme.preview.border,
              background: item === 2 ? theme.preview.accent : theme.preview.surface,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (themeId: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {NIPUX_THEMES.map((theme) => {
        const active = theme.id === value;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => {
              applyTheme(theme.id);
              onChange(theme.id);
            }}
            className={`group border p-3 text-left transition-colors ${
              active
                ? "border-[var(--border-strong)] bg-[var(--active-surface)]"
                : "border-[var(--border)] bg-transparent hover:border-[var(--border-strong)] hover:bg-[var(--hover-surface)]"
            }`}
          >
            <MiniConsole themeId={theme.id} />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[14px] text-[var(--foreground)]">{theme.label}</div>
              {active ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
            </div>
            <div className="mt-2 min-h-[44px] text-[12px] leading-[1.6] text-[var(--muted-foreground)]">
              {theme.body}
            </div>
          </button>
        );
      })}
    </div>
  );
}
