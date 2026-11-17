"use client";

import { Icon } from "./Icon";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LinkedRoom } from "@/lib/rooms/discovery.ts";

// Bouton « Salon » : ouvre une fenêtre qui liste les salons liés au sujet (les lire, y entrer)
// et propose d'en créer un nouveau. Les salons publics se lisent même sans compte.

const ICON = <Icon id="salon" />;

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`;
};

export function RoomsPopover({ postId, postTitle, roomCount, signedIn, canCreate }: { postId: string; postTitle: string; roomCount: number; signedIn: boolean; canCreate: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rooms, setRooms] = useState<LinkedRoom[] | null>(null);
  const [error, setError] = useState(false);
  const createHref = `/salons/nouveau?post=${postId}`;

  async function open() {
    dialog.current?.showModal();
    setError(false);
    try {
      const res = await fetch(`/api/posts/${postId}/salons`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setRooms(data.rooms);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    // Clic sur le fond : fermeture.
    const onClick = (e: MouseEvent) => { if (e.target === d) d.close(); };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button type="button" onClick={() => void open()} aria-haspopup="dialog"
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-soft px-2.5 text-sm font-semibold text-accent ring-1 ring-accent/25 transition hover:bg-accent hover:text-white">
        {ICON}
        {roomCount > 0 ? <>{roomCount} <span className="hidden sm:inline">salon{roomCount > 1 ? "s" : ""}</span></> : <><span className="sm:hidden">Salon</span><span className="hidden sm:inline">Discuter en salon</span></>}
      </button>
      <dialog ref={dialog} aria-labelledby={`salons-${postId}`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[12px] bg-white p-0 text-ink shadow-xl ring-1 ring-line backdrop:bg-ink/40">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="label-mono text-accent">Salons sur ce sujet</p>
            <h2 id={`salons-${postId}`} className="mt-1 line-clamp-2 font-display text-lg font-semibold leading-snug">{postTitle}</h2>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Fermer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-chip hover:text-ink">✕</button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-5 py-3">
          {error ? (
            <p className="py-6 text-center text-sm text-muted">Liste indisponible pour le moment.</p>
          ) : rooms === null ? (
            <p className="animate-pulse py-6 text-center text-sm text-muted">Chargement des salons…</p>
          ) : rooms.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Aucun salon ne discute encore de ce sujet. Lancez le premier !</p>
          ) : (
            <ul className="divide-y divide-line">
              {rooms.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.visibility === "private" ? "Sur invitation · " : ""}{r.archived ? "Archivé · " : ""}
                      {r.members} membre{r.members > 1 ? "s" : ""} · {r.recentMessages} message{r.recentMessages > 1 ? "s" : ""} sur 7 jours
                      {r.lastMessageAt ? ` · dernier ${ago(r.lastMessageAt)}` : ""}
                    </p>
                  </div>
                  <Link href={`/s/${r.id}#chat`} className={r.isMember ? "btn-primary px-3 py-2" : "btn-secondary px-3 py-2"}>{r.isMember ? "Ouvrir" : "Lire"}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-5 py-4">
          <p className="text-xs text-muted">Un autre angle, un groupe de travail ?</p>
          {canCreate ? (
            <Link href={createHref} className="btn-primary">+ Créer un nouveau salon</Link>
          ) : !signedIn ? (
            <Link href={`/connexion?next=${encodeURIComponent(createHref)}`} className="btn-primary">Se connecter pour créer un salon</Link>
          ) : (
            <Link href="/bienvenue" className="btn-secondary">Terminer mon inscription</Link>
          )}
        </div>
      </dialog>
    </>
  );
}
