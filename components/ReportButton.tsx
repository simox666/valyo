"use client";

import { useState } from "react";
import { api } from "@/lib/client";

const REASONS = [
  ["regles", "Non-respect des règles"],
  ["spam", "Spam ou promotion"],
  ["harcelement", "Harcèlement"],
  ["illegal", "Contenu illégal"],
  ["autre", "Autre motif"],
] as const;

/** Signalement (D32) : motif obligatoire, précision facultative. Le signalant reste confidentiel. */
export function ReportButton({ targetKind, targetId, label = "Signaler", subtle = false }: { targetKind: "post" | "comment" | "message" | "member"; targetId: string; label?: string; subtle?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("regles");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await api("POST", "/api/reports", { targetKind, targetId, reason, details });
    setBusy(false);
    if (result.ok) {
      setMessage({ ok: true, text: "Signalement transmis à la modération. Votre identité reste confidentielle." });
      setOpen(false);
    } else {
      setMessage({ ok: false, text: result.data.error ?? "Signalement impossible." });
    }
  }

  return (
    <span className="text-sm">
      {!open ? (
        <button type="button" className={subtle ? "text-xs font-medium text-muted hover:text-ink" : "btn-link"} onClick={() => setOpen(true)}>
          {label}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-1 inline-flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`motif-${targetId}`}>Motif</label>
          <select id={`motif-${targetId}`} value={reason} onChange={(e) => setReason(e.target.value)} className="input">
            {REASONS.map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Précision (facultative)" aria-label="Précision" className="input" />
          <button type="submit" disabled={busy} className="btn-secondary px-2 py-1">Envoyer</button>
          <button type="button" className="btn-link" onClick={() => setOpen(false)}>Annuler</button>
        </form>
      )}
      {message && <span className={message.ok ? "ml-2 font-semibold text-accent" : "error-text ml-2"}>{message.text}</span>}
    </span>
  );
}
