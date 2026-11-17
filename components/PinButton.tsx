"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

/** Épingler / désépingler une de ses publications en tête de son profil. */
export function PinButton({ postId, pinned, compact = false }: { postId: string; pinned: boolean; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle() {
    setBusy(true);
    setError(null);
    const result = await api("POST", "/api/me/epingle", { postId: pinned ? null : postId });
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.data.error ?? "Action impossible.");
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={toggle} className={compact ? "text-xs font-semibold text-muted hover:text-ink" : "btn-secondary"}>
        {pinned ? "Désépingler" : "Épingler sur mon profil"}
      </button>
      {error && <span role="alert" className="error-text">{error}</span>}
    </span>
  );
}
