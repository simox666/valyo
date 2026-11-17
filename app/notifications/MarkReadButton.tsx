"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function MarkAllReadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function markAll() {
    setBusy(true);
    setError(null);
    const result = await api("POST", "/api/notifications", { all: true });
    setBusy(false);
    if (!result.ok) { setError(result.data.error ?? "Impossible de marquer les notifications lues."); return; }
    window.dispatchEvent(new Event("valyo:notifications"));
    router.refresh();
  }
  return (
    <div>
    <button type="button" disabled={busy} onClick={markAll} className="btn-secondary px-3 py-1.5">
      Tout marquer lu
    </button>
    {error && <p role="alert" className="error-text">{error}</p>}
    </div>
  );
}
