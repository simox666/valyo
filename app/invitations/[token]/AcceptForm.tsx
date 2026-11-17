"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

/** Acceptation EXPLICITE : l'ouverture du lien ne consomme jamais l'invitation (F11). */
export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const result = await api("POST", "/api/invitations/accept", { token });
    setBusy(false);
    if (result.ok) router.push(`/s/${result.data.roomId}`);
    else setError(result.data.error ?? "Invitation inutilisable.");
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={accept} className="btn-primary px-4 py-2">
        Accepter l’invitation et rejoindre le salon
      </button>
      {error && <p className="error-text mt-2">{error}</p>}
    </div>
  );
}
