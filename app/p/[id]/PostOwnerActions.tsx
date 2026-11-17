"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function PostOwnerActions({ postId, subtle = false }: { postId: string; subtle?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    const result = await api("DELETE", `/api/posts/${postId}`);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.data.error ?? "Suppression impossible.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/p/${postId}/modifier`} className={subtle ? "text-xs font-medium text-muted hover:text-ink" : "btn-secondary"}>
        Modifier
      </Link>
      {confirming ? (
        <div role="alertdialog" aria-label="Confirmer la suppression" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Supprimer définitivement cette publication ?</span>
          <button type="button" className="btn-danger" disabled={busy} onClick={remove} autoFocus>
            Oui, supprimer
          </button>
          <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
            Annuler
          </button>
        </div>
      ) : (
        <button type="button" className={subtle ? "text-xs font-medium text-muted hover:text-red-700" : "btn-danger"} onClick={() => setConfirming(true)}>
          Supprimer
        </button>
      )}
      {error && (
        <p role="alert" className="error-text w-full">
          {error}
        </p>
      )}
    </div>
  );
}
