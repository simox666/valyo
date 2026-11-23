"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export function LoginForm({ next, invitation }: { next: string; invitation?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api<{ devLink?: string }>("POST", "/api/auth/request-link", { email, next, invitation });
    setBusy(false);
    if (result.ok) setSent({ devLink: result.data.devLink });
    else setError(result.data.error ?? "Une erreur est survenue.");
  }

  if (sent) {
    return (
      <div className="card mt-6 p-5" role="status">
        <p className="font-semibold">Vérifiez votre boîte de réception.</p>
        <p className="mt-1 text-soft">
          Un lien de connexion a été envoyé à <strong>{email}</strong>. Il est valable 15 minutes et ne sert qu’une fois.
        </p>
        {sent.devLink && (
          <div className="mt-4 rounded-card border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-semibold">Mode développement : aucun e-mail n’a été envoyé.</p>
            <p className="mt-1">Le service d’envoi n’est pas configuré. Utilisez ce lien local :</p>
            <a href={sent.devLink} className="mt-2 block font-semibold text-accent underline">
              Ouvrir le lien de connexion
            </a>
          </div>
        )}
        <button type="button" className="btn-link mt-4" onClick={() => setSent(null)}>
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="label">
          Adresse e-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`field ${error ? "field-invalid" : ""}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "email-error" : "email-hint"}
        />
        {error ? (
          <p id="email-error" role="alert" className="error-text">
            {error}
          </p>
        ) : (
          <p id="email-hint" className="hint">
            Votre adresse n’est jamais affichée publiquement.
          </p>
        )}
      </div>
      <button type="submit" disabled={busy || !email} className="btn-primary w-full">
        {busy ? "Envoi…" : "Recevoir le lien de connexion"}
      </button>
    </form>
  );
}
