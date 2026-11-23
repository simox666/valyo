"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api("DELETE", "/api/me", { confirm });
    setBusy(false);
    if (result.ok) {
      // SEC-05 : plus de compte, plus de brouillons locaux.
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("valyo:brouillon-publication")) localStorage.removeItem(key);
        }
      } catch {}
      router.push("/?compte=supprime");
      router.refresh();
    } else setError(result.data.fields?.confirm ?? result.data.error ?? "Suppression impossible.");
  }

  return (
    <div className="mt-3 space-y-3 text-[15px]">
      <p>Ce qui se passe si vous supprimez votre compte :</p>
      <ul className="list-disc space-y-1 pl-5 text-soft">
        <li>vous êtes déconnecté de tous vos appareils ;</li>
        <li>votre profil, votre adresse e-mail, votre pseudonyme et vos abonnements sont effacés ;</li>
        <li>vos messages privés, vos notifications et votre historique de présence sont effacés aussi ;</li>
        <li>
          vos publications et commentaires restent visibles pour la continuité des discussions, mais sont attribués à « Membre supprimé », sans lien
          vers vous. Supprimez-les d’abord si vous ne voulez pas qu’ils restent.
        </li>
      </ul>
      <p className="font-semibold">Cette action est définitive.</p>
      {open ? (
        <form onSubmit={remove} className="space-y-2" noValidate>
          <label htmlFor="confirm" className="label">
            Tapez SUPPRIMER pour confirmer
          </label>
          <input
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`field max-w-xs ${error ? "field-invalid" : ""}`}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "confirm-error" : undefined}
          />
          {error && <p id="confirm-error" role="alert" className="error-text">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-danger" disabled={busy || confirm !== "SUPPRIMER"}>
              Supprimer définitivement mon compte
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
          Supprimer mon compte…
        </button>
      )}
    </div>
  );
}
