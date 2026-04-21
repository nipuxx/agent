import { redirect } from "next/navigation";

const BACKEND_BASE = (process.env.NIPUXD_URL || process.env.NEXT_PUBLIC_NIPUXD_URL || "http://127.0.0.1:9384").replace(
  /\/$/,
  "",
);

type SettingsPayload = {
  setup_completed?: boolean;
};

async function getSettings(): Promise<SettingsPayload | null> {
  try {
    const response = await fetch(`${BACKEND_BASE}/api/settings`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as SettingsPayload;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const settings = await getSettings();
  if (settings) {
    redirect(settings.setup_completed ? "/dashboard" : "/setup");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-[14px] text-[var(--muted-foreground)]">
      Unable to reach Nipux backend.
    </div>
  );
}
