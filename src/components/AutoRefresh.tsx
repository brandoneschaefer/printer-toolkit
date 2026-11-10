"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh the server component tree on an interval while a job is in flight. */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-brand-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
      Live — refreshing…
    </span>
  );
}
