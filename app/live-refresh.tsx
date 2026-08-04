"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const events = new EventSource("/api/events");
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let connectedOnce = false;

    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    };

    events.addEventListener("products-changed", refresh);
    events.addEventListener("open", () => {
      if (connectedOnce) refresh();
      connectedOnce = true;
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      events.close();
    };
  }, [router]);

  return null;
}
