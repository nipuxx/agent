"use client";

import { Bot, FileCode2, Globe, TerminalSquare } from "lucide-react";
import { AppShell } from "./app-shell";
import { Panel } from "./panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const agentCards = [
  {
    icon: FileCode2,
    title: "Code agent",
    body: "Repo inspection, patching, tests, and filesystem-heavy work over the Hermes tool boundary.",
  },
  {
    icon: Globe,
    title: "Browser agent",
    body: "Search, browse, and extract workflows that should feel native in the web UI.",
  },
  {
    icon: TerminalSquare,
    title: "Terminal agent",
    body: "Command-heavy sessions with explicit approvals and controlled execution boundaries.",
  },
  {
    icon: Bot,
    title: "Orchestrator",
    body: "A higher-level surface that chooses the right Hermes session shape for the task.",
  },
];

export function AgentsView() {
  return (
    <AppShell
      title="Agents"
      subtitle="This is where Nipux can expose specialized agent surfaces without binding the frontend to Hermes implementation details."
    >
      <Panel
        title="Agent surfaces"
        description="Keep the UI opinionated and stable. Map these surfaces into Hermes sessions through the daemon layer."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {agentCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="bg-[var(--card-2)]">
                <CardHeader>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)]">
                    <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </div>
                  <CardTitle>{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-[var(--muted-foreground)]">
                  {card.body}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Panel>
    </AppShell>
  );
}
