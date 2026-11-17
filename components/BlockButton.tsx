"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

/** Bloquer/débloquer un membre (D31), avec la limite des salons partagés annoncée. */
export function BlockButton({ userId, initialBlocked }: { userId: string; initialBlocked: boolean }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (
      !blocked &&
      !confirm(
        "Bloquer ce membre masque ses publications et commentaires publics pour vous, et empêche ses invitations.\n\nLimite : dans un salon que vous partagez déjà, ses messages de chat restent visibles (conversation de groupe).",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await api("POST", "/api/blocks", { userId, blocked: !blocked });
    setBusy(false);
    if (result.ok) {
      setBlocked(!blocked);
      router.refresh();
    } else {
      setError(result.data.error ?? "Action impossible.");
    }
  }

  return (
    <span>
      <button type="button" disabled={busy} onClick={toggle} className="btn-link text-sm">
        {blocked ? "Débloquer" : "Bloquer"}
      </button>
      {error && <span className="error-text ml-2 text-sm">{error}</span>}
    </span>
  );
}
