"use client";

import { AppShell } from "./app-shell";
import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const chats = [
  "New Chat",
  "Hardware bring-up",
  "Runtime config review",
  "Hermes bridge notes",
];

export function ChatView() {
  return (
    <AppShell
      title="Chat"
      subtitle="The web chat surface should feel closer to Open WebUI than a marketing landing page."
    >
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Panel title="Sessions" description="Minimal list, no decorative noise.">
          <div className="space-y-2">
            <Button className="w-full justify-start" variant="outline">
              + New Chat
            </Button>
            {chats.map((chat, index) => (
              <div
                key={chat}
                className={`rounded-sm px-3 py-2 text-sm ${index === 0 ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"}`}
              >
                {chat}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Conversation" description="The main content area should stay quiet and readable.">
          <div className="flex min-h-[620px] flex-col">
            <div className="flex-1 space-y-6">
              <div className="max-w-[85%] rounded-sm border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-sm leading-7 text-[var(--foreground)]">
                I&apos;ll help you run Hermes locally. First I’ll inspect the machine, then I’ll recommend the safest runtime and Carnice build.
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Future work: stream real daemon-backed sessions here instead of placeholder copy.</div>
            </div>
            <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--card-2)] p-3">
              <Textarea placeholder="Message…" className="min-h-[88px] border-0 bg-transparent px-0 py-0 focus-visible:ring-0" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Input value="Tools" readOnly className="h-8 w-20 border-[var(--border)] bg-[var(--card)] text-xs" />
                  <Input value="Research" readOnly className="h-8 w-24 border-[var(--border)] bg-[var(--card)] text-xs" />
                </div>
                <Button size="sm">Send</Button>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
