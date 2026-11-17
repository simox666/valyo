"use client";

import { Icon } from "./Icon";

import { useState } from "react";

/** Partage natif (téléphone) si disponible, sinon copie du lien. */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Partage annulé ou presse-papiers refusé : rien à faire.
    }
  }
  return (
    <button type="button" onClick={share} aria-label="Partager" className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-soft hover:bg-chip hover:text-ink">
      <Icon id="partager" />
      {copied && <span className="text-xs">Lien copié</span>}
    </button>
  );
}
