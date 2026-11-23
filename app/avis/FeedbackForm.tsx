"use client";

import { useState } from "react";
import { api } from "@/lib/client";

const KINDS = [
  ["bug", "Quelque chose ne marche pas"],
  ["idee", "Une idée"],
  ["autre", "Autre remarque"],
] as const;

export function FeedbackForm({ page }: { page: string }) {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("idee");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api("POST", "/api/avis", { kind, body, page });
    setBusy(false);
    if (result.ok) {
      setSent(true);
      setBody("");
    } else setError(result.data.error ?? "Envoi impossible.");
  }

  if (sent) {
    return (
      <div role="status" className="rounded-card bg-accent-soft p-5">
        <p className="font-bold text-accent">Merci, c’est bien reçu !</p>
        <p className="mt-1 text-sm text-soft">Chaque retour est lu. C’est ce qui décide de la suite de Valyo.</p>
        <button type="button" className="btn-link mt-3" onClick={() => setSent(false)}>Envoyer un autre avis</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="label">De quoi s’agit-il ?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-card border px-3 py-2 text-sm font-semibold ${kind === value ? "border-accent bg-accent-soft text-accent" : "border-line bg-white"}`}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="label">Votre message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={2000}
          required
          placeholder={kind === "bug" ? "Qu’avez-vous fait, qu’attendiez-vous, que s’est-il passé ?" : "Dites-nous tout…"}
          className="field"
        />
        <span className="mt-1 block text-right text-xs text-muted">{body.length}/2 000</span>
      </label>
      {page && <p className="text-xs text-muted">Page concernée : {page}</p>}
      {error && <p role="alert" className="error-text">{error}</p>}
      <button type="submit" disabled={busy || body.trim().length < 5} className="btn-primary">{busy ? "Envoi…" : "Envoyer mon avis"}</button>
    </form>
  );
}
