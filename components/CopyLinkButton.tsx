"use client";

import { useState } from "react";

/** Copie le lien ; si le navigateur refuse l'accès au presse-papiers, affiche le lien à copier à la main. */
export function CopyLinkButton({ path }: { path: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("manual");
    }
  }

  return (
    <div>
      <button type="button" onClick={copy} className="btn-secondary">
        {state === "copied" ? "Lien copié ✓" : "Partager le lien"}
      </button>
      <span role="status" className="sr-only">
        {state === "copied" ? "Lien copié dans le presse-papiers" : ""}
      </span>
      {state === "manual" && (
        <div className="mt-2">
          <label className="label" htmlFor="manual-link">
            Copie automatique indisponible : sélectionnez le lien ci-dessous.
          </label>
          <input id="manual-link" readOnly value={url} className="field" onFocus={(e) => e.currentTarget.select()} autoFocus />
        </div>
      )}
    </div>
  );
}
