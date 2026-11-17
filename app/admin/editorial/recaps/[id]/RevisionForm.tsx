"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

/** Demande administrateur d'un développement (A10) ; les demandes publiques restent désactivées (D8 proposé). */
export function DevelopmentRequestButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function request() {
    setBusy(true);
    setMessage(null);
    const result = await api("POST", "/api/admin/editorial/developments", { recapItemId: itemId });
    setBusy(false);
    setMessage(
      result.ok
        ? { ok: true, text: "Développement demandé : il suivra rédaction puis vérification, sous le même budget." }
        : { ok: false, text: result.data.error ?? "Demande impossible." },
    );
    if (result.ok) router.refresh();
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={request} className="btn-link text-sm">
        Demander un développement (administration)
      </button>
      {message && <span className={message.ok ? "text-sm font-semibold text-accent" : "error-text"}>{message.text}</span>}
    </span>
  );
}

/** Relecture humaine d'un élément révisé (ACC05) : seule voie de retour vers un état publiable. */
export function RelectureButton({ itemId, expectedVersion }: { itemId: string; expectedVersion: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function approve() {
    const motif = prompt("Relecture : attestez avoir relu le texte exact contre les sources (motif enregistré) :");
    if (!motif || motif.trim().length < 5) return;
    setBusy(true);
    const result = await api("POST", `/api/admin/editorial/recap-items/${itemId}`, { action: "relecture", motif, expectedVersion });
    setBusy(false);
    setMessage(result.ok ? { ok: true, text: "Relecture enregistrée." } : { ok: false, text: result.data.error ?? "Relecture impossible." });
    if (result.ok) router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={approve} className="btn-secondary px-2 py-1 text-sm">
        Marquer relu contre les sources
      </button>
      {message && <span className={message.ok ? "text-sm font-semibold text-accent" : "error-text"}>{message.text}</span>}
    </span>
  );
}

/** Revalidation du brouillon après relecture de chaque élément révisé (ACC05). */
export function RecapReadyButton({ recapId, expectedVersion }: { recapId: string; expectedVersion: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function ready() {
    const motif = prompt("Motif de la revalidation du brouillon :");
    if (!motif || motif.trim().length < 5) return;
    setBusy(true);
    const result = await api("POST", `/api/admin/editorial/recaps/${recapId}`, { action: "ready", motif, expectedVersion });
    setBusy(false);
    setMessage(result.ok ? { ok: true, text: "Brouillon revalidé." } : { ok: false, text: result.data.error ?? "Revalidation impossible." });
    if (result.ok) router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={ready} className="btn-secondary px-3 py-1.5">
        Revalider le brouillon (après relecture)
      </button>
      {message && <span className={message.ok ? "text-sm font-semibold text-accent" : "error-text"}>{message.text}</span>}
    </span>
  );
}

/** Révision éditoriale d'un élément non publié (A7) : correction du texte avec motif obligatoire. */
export function RevisionForm({ itemId, initialTitle, initialSummary }: { itemId: string; initialTitle: string; initialSummary: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) {
    return (
      <button type="button" className="btn-link text-sm" onClick={() => setOpen(true)}>
        Réviser cet élément (motif obligatoire)
      </button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await api("PATCH", `/api/admin/editorial/recap-items/${itemId}`, { title, summary, motif });
    setBusy(false);
    if (result.ok) {
      setMessage({ ok: true, text: "Révision enregistrée. La vérification de fidélité est invalidée pour le texte modifié." });
      setMotif("");
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.data.error ?? "Révision impossible." });
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl border border-line p-3 text-sm">
      <label className="block font-semibold">
        Titre corrigé
        <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={200} className="input mt-1 w-full" />
      </label>
      <label className="block font-semibold">
        Résumé corrigé
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} required minLength={20} maxLength={1200} rows={4} className="input mt-1 w-full" />
      </label>
      <label className="block font-semibold">
        Motif de la révision
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          required
          minLength={5}
          maxLength={500}
          placeholder="Par exemple : chiffre imprécis corrigé d'après la source"
          className="input mt-1 w-full"
        />
      </label>
      <p className="text-neutral-600">Toute modification du texte invalide la vérification de fidélité : elle sera affichée comme telle.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary px-3 py-1.5">Enregistrer la révision</button>
        <button type="button" className="btn-link" onClick={() => setOpen(false)}>Annuler</button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "font-semibold text-accent" : "error-text"}>{message.text}</p>
      )}
    </form>
  );
}
