"use client";

import { useState } from "react";
import { api } from "@/lib/client";

/** Demande d'un lien de contestation pour un compte banni (ACC09). */
export function AccessRequestForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await api("POST", "/api/appeals/access", { email });
    setBusy(false);
    setMessage(result.ok ? String(result.data.message) : (result.data.error ?? "Demande impossible."));
    if (result.ok && result.data.devLink) setDevLink(String(result.data.devLink));
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block font-semibold">
        Adresse e-mail du compte banni
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} className="input mt-1 w-full" />
      </label>
      <button type="submit" disabled={busy} className="btn-primary px-4 py-2">Recevoir le lien de contestation</button>
      {message && <p role="status" className="text-sm">{message}</p>}
      {devLink && (
        <p className="text-sm">
          Mode développement : <a href={devLink} className="btn-link">ouvrir la page de contestation</a>
        </p>
      )}
    </form>
  );
}

/** Dépôt de la contestation avec le jeton dédié (aucune session ouverte). */
export function TokenAppealForm({ actionId, token }: { actionId: string; token: string }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await api("POST", "/api/appeals", { actionId, body, token });
    setBusy(false);
    setMessage(
      result.ok
        ? { ok: true, text: "Contestation envoyée. Elle sera examinée, si possible par une autre personne ; la décision motivée sera notifiée." }
        : { ok: false, text: result.data.error ?? "Envoi impossible." },
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 text-sm">
      <label className="block font-semibold">
        Votre contestation
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} maxLength={2000} rows={3} className="input mt-1 w-full" />
      </label>
      <button type="submit" disabled={busy} className="btn-primary px-3 py-1.5">Envoyer la contestation</button>
      {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "font-semibold text-accent" : "error-text"}>{message.text}</p>}
    </form>
  );
}
