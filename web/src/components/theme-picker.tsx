"use client";

import { Check } from "lucide-react";

import { applyTheme, NIPUX_THEMES, themeById } from "@/lib/themes";

function MiniConsole({ themeId, compact = false }: { themeId: string; compact?: boolean }) {
  const theme = themeById(themeId);
  if (compact) {
    return (
      <div
        className="nipux-preview h-[62px] w-[78px] shrink-0 overflow-hidden border p-2"
        style={{
          background: theme.preview.background,
          borderColor: theme.preview.border,
          color: theme.preview.foreground,
          borderRadius: theme.preview.radius,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="h-2 w-9" style={{ background: theme.preview.foreground, opacity: 0.8, borderRadius: theme.preview.radius }} />
          <div className="h-2 w-4" style={{ background: theme.preview.accent, borderRadius: theme.preview.radius }} />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-2 w-full" style={{ background: theme.preview.foreground, borderRadius: theme.preview.radius }} />
          <div className="h-2 w-11/12" style={{ background: theme.preview.muted, borderRadius: theme.preview.radius }} />
          <div className="h-2 w-2/3" style={{ background: theme.preview.muted, borderRadius: theme.preview.radius }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="nipux-preview h-[122px] overflow-hidden border p-3"
      style={{
        background: theme.preview.background,
        borderColor: theme.preview.border,
        color: theme.preview.foreground,
        borderRadius: theme.preview.radius,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="h-2" style={{ width: theme.preview.rail, maxWidth: compact ? 42 : 70, background: theme.preview.foreground, opacity: 0.8, borderRadius: theme.preview.radius }} />
        <div className="h-2 w-5" style={{ background: theme.preview.accent, borderRadius: theme.preview.radius }} />
      </div>
      <div className="mt-4 grid grid-cols-[1fr_54px] gap-3">
        <div className="space-y-2">
          <div className="h-3 w-24" style={{ background: theme.preview.foreground, borderRadius: theme.preview.radius }} />
          <div className="h-2 w-32" style={{ background: theme.preview.muted, borderRadius: theme.preview.radius }} />
          <div className="h-2 w-20" style={{ background: theme.preview.muted, borderRadius: theme.preview.radius }} />
        </div>
        <div className="h-14 border" style={{ borderColor: theme.preview.border, background: theme.preview.surface, borderRadius: theme.preview.radius }} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-5 border"
            style={{
              borderColor: theme.preview.border,
              background: item === 2 ? theme.preview.accent : theme.preview.surface,
              borderRadius: theme.preview.radius,
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
  compact = false,
}: {
  value: string;
  onChange: (themeId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "nipux-theme-grid-compact" : "nipux-theme-grid"}>
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
            data-active={active}
            className={`nipux-theme-tile group text-left ${compact ? "grid grid-cols-[78px_minmax(0,1fr)] items-start gap-3" : ""}`}
          >
            <MiniConsole themeId={theme.id} compact={compact} />
            <div className={compact ? "min-w-0" : ""}>
            <div className={`${compact ? "pt-0.5" : "mt-3"} flex items-center justify-between gap-3`}>
              <div className="text-[14px] text-[var(--foreground)]">{theme.label}</div>
              {active ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
            </div>
            <div className={`${compact ? "mt-1 max-h-[38px] overflow-hidden" : "mt-2 min-h-[44px]"} text-[12px] leading-[1.6] text-[var(--muted-foreground)]`}>
              {theme.body}
            </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
