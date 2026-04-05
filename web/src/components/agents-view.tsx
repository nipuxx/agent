"use client";

import { Bot, FolderCode, Globe, Search, TerminalSquare } from "lucide-react";
import { AppShell } from "./app-shell";
import { Panel } from "./panel";

const AGENTS = [
  {
    icon: FolderCode,
    title: "Code Agent",
    description: "Repository inspection, edits, tests, and patch application against the Hermes tool boundary.",
  },
  {
    icon: Globe,
    title: "Browser Agent",
    description: "Navigation, extraction, search, and form workflows through a Nipux-managed browser surface.",
  },
  {
    icon: TerminalSquare,
    title: "Terminal Agent",
    description: "Command execution and environment work with explicit approval and stable shell orchestration.",
  },
  {
    icon: Search,
    title: "Research Agent",
    description: "Longer-form browsing and analysis with model-backed summary capture and task handoff.",
  },
];

export function AgentsView() {
  return (
    <AppShell title="Agent Board" kicker="Specialized surfaces over Hermes">
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Why this page exists" eyebrow="Agent operating model">
          <div className="space-y-4 text-sm leading-7 text-[var(--dim)]">
            <p>
              Nipux should expose structured agent entrypoints rather than a single giant chat screen.
              The frontend can present specialized cards and workflows while the backend maps them into
              Hermes sessions, toolsets, and profiles.
            </p>
            <p>
              That lets the UI evolve independently from Hermes internals and gives the user cleaner
              starting points than a blank terminal-style session.
            </p>
          </div>
        </Panel>

        <Panel title="Agent Surfaces" eyebrow="Planned roles">
          <div className="grid gap-4 md:grid-cols-2">
            {AGENTS.map((agent) => {
              const Icon = agent.icon;
              return (
                <div key={agent.title} className="rounded-2xl border border-white/8 bg-black/10 p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6">
                    <Icon className="h-5 w-5 text-[var(--accent)]" />
                  </div>
                  <div className="text-base font-semibold">{agent.title}</div>
                  <p className="mt-2 text-sm leading-7 text-[var(--dim)]">{agent.description}</p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Hermes compatibility rule" eyebrow="Non-negotiable boundary">
          <div className="flex gap-4 rounded-2xl border border-white/8 bg-black/10 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/6">
              <Bot className="h-5 w-5 text-[var(--accent-2)]" />
            </div>
            <div className="text-sm leading-7 text-[var(--dim)]">
              Every agent card in Nipux should resolve into a daemon-owned contract, not a frontend
              dependency on Hermes implementation details. That is how Nipux can keep shipping while
              Hermes upstream changes daily.
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

