"use client";

export function logEvent(name: string, props?: Record<string, unknown>) {
  try {
    void fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, props, ts: Date.now() }),
      keepalive: true,
    });
  } catch {
    // best-effort only, never block the UI on analytics
  }
}
