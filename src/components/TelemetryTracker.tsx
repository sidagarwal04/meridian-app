"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const VISITOR_STORAGE_KEY = "meridian-vid";

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let vid = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!vid) {
      vid = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VISITOR_STORAGE_KEY, vid);
    }
    return vid;
  } catch {
    return "";
  }
}

export function TelemetryTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;
    if (lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;

    const visitorId = getOrCreateVisitorId();
    const referrer = typeof document !== "undefined" ? document.referrer || undefined : undefined;

    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "visit",
        path: pathname,
        visitorId,
        referrer,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
