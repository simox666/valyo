"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function CreateInvitation({ remaining }: { remaining: number | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await api<{ path: string }>("POST", "/api/platform-invitations", { note });
    setBusy(false);
    if (!result.ok) return setError(result.data.error ?? "Création impossible.");
    setLink(`${window.location.origin}${result.data.path}`);
    setNote("");
    router.refresh();
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="label">Pour qui ? <span className="font-normal text-muted">(note privée, facultative)</span></span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Ex. : Léa, collègue curieuse d’IA" className="field" />
        </label>
        <button type="submit" disabled={busy || remaining === 0} className="btn-primary">
          {busy ? "Création…" : "Créer un lien d’invitation"}
        </button>
      </form>
      {remaining !== null && <p className="text-xs text-muted">{remaining} invitation{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""}.</p>}
      {error && <p role="alert" className="error-text">{error}</p>}
      {link && (
        <div role="status" className="rounded-card border border-accent/30 bg-accent-soft p-4">
          <p className="font-bold text-accent">Lien prêt — à envoyer maintenant</p>
          <p className="mt-1 text-xs text-soft">Pour votre sécurité, il ne sera plus réaffiché. Valable 14 jours, pour une seule personne.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm">{link}</code>
            <button type="button" onClick={copy} className="btn-secondary">{copied ? "Copié ✓" : "Copier"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RevokeInvitation({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="btn-link text-sm"
      onClick={async () => {
        setBusy(true);
        const result = await api("DELETE", `/api/platform-invitations/${id}`);
        setBusy(false);
        if (result.ok) router.refresh();
      }}
    >
      Révoquer
    </button>
  );
}
