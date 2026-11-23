"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api, loginUrl } from "@/lib/client";
import { Icon } from "./Icon";

// Relayer une publication à ses abonnés, avec son avis (facultatif). Même famille de
// boutons que les réactions ; une petite boîte de dialogue recueille l'avis.

export function RelayButton({ postId, initial, signedIn, canRelay }: {
  postId: string;
  initial: { count: number; mine: boolean; myNote: string };
  signedIn: boolean;
  canRelay: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState(initial);
  const [note, setNote] = useState(initial.myNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(on: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await api<{ count: number; mine: boolean; myNote: string }>("POST", `/api/posts/${postId}/relais`, { on, note: on ? note : "" });
    setBusy(false);
    if (result.ok) {
      setState({ count: result.data.count, mine: result.data.mine, myNote: result.data.myNote });
      if (!on) setNote("");
      dialog.current?.close();
    } else setError(result.data.error ?? "Action impossible.");
  }

  const icon = <Icon id="relayer" />;
  const base = "inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition hover:bg-chip sm:px-2.5";

  if (!signedIn) {
    return (
      <Link href={loginUrl(`/p/${postId}`)} className={`${base} text-soft hover:text-ink`} title="Relayer à vos abonnés (connexion)">
        {icon}{state.count > 0 ? state.count : <span className="hidden sm:inline">Relayer</span>}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { if (canRelay) { setError(null); dialog.current?.showModal(); } }}
        disabled={!canRelay}
        aria-pressed={state.mine}
        title={state.mine ? "Relayé à vos abonnés" : "Relayer à vos abonnés"}
        className={`${base} ${state.mine ? "font-semibold text-accent" : "text-soft hover:text-ink"} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {icon}
        {state.count > 0 ? state.count : <span className="hidden sm:inline">Relayer</span>}
      </button>
      <dialog ref={dialog} aria-label="Relayer cette publication"
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card bg-white p-0 shadow-xl backdrop:bg-ink/30"
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="p-4 sm:p-5">
          <p className="label-mono">{state.mine ? "Votre relais" : "Relayer à vos abonnés"}</p>
          <p className="mt-1 text-sm text-soft">La publication apparaîtra dans le fil « Pour vous » de vos abonnés, avec votre avis.</p>
          <label htmlFor={`relais-${postId}`} className="sr-only">Votre avis (facultatif)</label>
          <textarea id={`relais-${postId}`} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Votre avis (facultatif) : pourquoi ça vaut la lecture, ce qui vous a étonné…"
            className="field mt-3 resize-y py-2 text-[15px]" />
          {error && <p role="alert" className="error-text mt-2">{error}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {state.mine && (
              <button type="button" disabled={busy} onClick={() => void save(false)} className="mr-auto text-sm font-semibold text-red-700 underline-offset-2 hover:underline disabled:opacity-50">
                Ne plus relayer
              </button>
            )}
            <button type="button" onClick={() => dialog.current?.close()} className="btn-secondary">Annuler</button>
            <button type="button" disabled={busy} onClick={() => void save(true)} className="btn-primary">
              {busy ? "…" : state.mine ? "Mettre à jour" : "Relayer"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
