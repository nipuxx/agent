"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useLiveSummary } from "@/lib/use-live-summary";
import { isSetupComplete } from "@/lib/setup";

export function HomeRedirect() {
  const router = useRouter();
  const { summary, error } = useLiveSummary();

  useEffect(() => {
    if (!summary) {
      return;
    }
    router.replace(isSetupComplete(summary.settings) ? "/dashboard" : "/setup");
  }, [router, summary]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-[14px] text-[var(--muted-foreground)]">
      {error ?? "Booting Nipux..."}
    </div>
  );
}
