"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { ThemePicker } from "@/components/ThemePicker";

export function OnboardingForm({ next, themes }: { next: string; themes: { id: string; name: string; description: string }[] }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptRules, setAcceptRules] = useState(false);
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api("POST", "/api/onboarding", { handle, displayName, acceptRules, themeIds });
    if (result.ok) {
      // Sans destination précise, les premiers pas aident à échanger dès aujourd'hui ;
      // une destination précise (invitation, publication, salon) est respectée.
      router.push(next === "/" ? "/bienvenue/premiers-pas" : next);
      router.refresh();
      return;
    }
    setBusy(false);
    setFields(result.data.fields ?? {});
    setError(result.data.error ?? "Une erreur est survenue.");
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
      {error && (
        <p role="alert" className="card border-red-200 bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="handle" className="label">
          Pseudonyme
        </label>
        <div className="flex items-center gap-1">
          <span className="text-muted" aria-hidden>
            @
          </span>
          <input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            autoComplete="username"
            className={`field ${fields.handle ? "field-invalid" : ""}`}
            aria-invalid={Boolean(fields.handle)}
            aria-describedby="handle-help"
          />
        </div>
        <p id="handle-help" className={fields.handle ? "error-text" : "hint"}>
          {fields.handle ?? "Unique, il sert d’adresse à votre profil. 3 à 24 caractères : lettres, chiffres ou _."}
        </p>
      </div>
      <div>
        <label htmlFor="displayName" className="label">
          Nom affiché
        </label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="nickname"
          className={`field ${fields.displayName ? "field-invalid" : ""}`}
          aria-invalid={Boolean(fields.displayName)}
          aria-describedby="displayName-help"
        />
        <p id="displayName-help" className={fields.displayName ? "error-text" : "hint"}>
          {fields.displayName ?? "Votre prénom, un nom ou un surnom. Modifiable plus tard."}
        </p>
      </div>
      <fieldset>
        <legend className="label">Vos centres d’intérêt (facultatif)</legend>
        <p className="hint mb-2">Ils composent votre fil « Pour vous » ; « Les plus récentes » garde tous les thèmes. Vous pouvez passer cette étape.</p>
        <ThemePicker themes={themes} selected={themeIds} onChange={setThemeIds} />
      </fieldset>
      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={acceptRules}
            onChange={(e) => setAcceptRules(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[#1C4F3C]"
            aria-invalid={Boolean(fields.acceptRules)}
            aria-describedby={fields.acceptRules ? "rules-error" : undefined}
          />
          <span>
            J’ai 15 ans ou plus et j’accepte les{" "}
            <Link href="/regles" target="_blank" className="btn-link">
              règles de la communauté
            </Link>
            .
          </span>
        </label>
        {fields.acceptRules && (
          <p id="rules-error" className="error-text">
            {fields.acceptRules}
          </p>
        )}
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Enregistrement…" : "Terminer l’inscription"}
      </button>
    </form>
  );
}
