"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { LocalTime } from "@/components/LocalTime";
import type { Meetup } from "@/lib/rooms/meetups.ts";

// Rendez-vous du salon : liste des prochains, proposition et annulation pour la modération.
// La date saisie en heure locale du navigateur est envoyée en ISO (UTC) au serveur.

export function RoomMeetups({ roomId, initial, canManage }: { roomId: string; initial: Meetup[]; canManage: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [meetups, setMeetups] = useState(initial);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const starts = new Date(when);
    if (!when || !Number.isFinite(starts.getTime())) { setError("Choisissez une date et une heure."); return; }
    setBusy(true);
    setError(null);
    const result = await api<{ meetup: Meetup }>("POST", `/api/rooms/${roomId}/rendez-vous`, { title, details, startsAt: starts.toISOString() });
    setBusy(false);
    if (result.ok) {
      setMeetups((m) => [...m, result.data.meetup].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setTitle(""); setDetails(""); setWhen("");
      dialog.current?.close();
      router.refresh();
    } else setError(result.data.error ?? "Création impossible.");
  }

  async function cancel(id: string) {
    setBusy(true);
    const result = await api("POST", `/api/rooms/${roomId}/rendez-vous`, { cancel: id });
    setBusy(false);
    if (result.ok) { setMeetups((m) => m.filter((x) => x.id !== id)); router.refresh(); }
  }

  if (!meetups.length && !canManage) return null;
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-bold">
        <span aria-hidden>📅</span> Rendez-vous
      </h2>
      {meetups.length ? (
        <ol className="mt-3 space-y-3">
          {meetups.map((m) => (
            <li key={m.id} className="rounded-lg bg-paper p-3 ring-1 ring-line">
              <p className="label-mono text-accent"><LocalTime iso={m.startsAt} mode="full" /></p>
              <p className="mt-1 text-sm font-semibold leading-snug">{m.title}</p>
              {m.details && <p className="mt-1 text-xs leading-relaxed text-soft">{m.details}</p>}
              <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                <span>Proposé par {m.creatorName}</span>
                {canManage && <button type="button" disabled={busy} onClick={() => void cancel(m.id)} className="font-semibold text-red-700 underline-offset-2 hover:underline disabled:opacity-50">Annuler</button>}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-muted">Un journal club, une session « demandez-moi »… Donnez un rendez-vous régulier à votre salon : c’est ce qui fait revenir ses membres.</p>
      )}
      {canManage && (
        <>
          <button type="button" onClick={() => dialog.current?.showModal()} className="btn-secondary mt-3 w-full">+ Proposer un rendez-vous</button>
          <dialog ref={dialog} aria-label="Proposer un rendez-vous" className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card bg-white p-0 shadow-xl backdrop:bg-ink/30"
            onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
            <form onSubmit={create} className="space-y-3 p-4 sm:p-5">
              <p className="label-mono">Nouveau rendez-vous</p>
              <div>
                <label htmlFor={`rdv-titre-${roomId}`} className="mb-1 block text-sm font-semibold">Titre</label>
                <input id={`rdv-titre-${roomId}`} value={title} onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={80} required placeholder="Journal club : l’étude de la semaine" className="field py-2" />
              </div>
              <div>
                <label htmlFor={`rdv-date-${roomId}`} className="mb-1 block text-sm font-semibold">Date et heure</label>
                <input id={`rdv-date-${roomId}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required className="field py-2" />
              </div>
              <div>
                <label htmlFor={`rdv-details-${roomId}`} className="mb-1 block text-sm font-semibold">Détails <span className="font-normal text-muted">(facultatif)</span></label>
                <textarea id={`rdv-details-${roomId}`} rows={2} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Ce qu’on lira, le lien de l’étude, comment se préparer…" className="field resize-y py-2" />
              </div>
              {error && <p role="alert" className="error-text">{error}</p>}
              <p className="text-xs text-muted">Le rendez-vous sera annoncé dans la discussion : les membres qui suivent le salon seront notifiés.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => dialog.current?.close()} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={busy} className="btn-primary">{busy ? "…" : "Proposer"}</button>
              </div>
            </form>
          </dialog>
        </>
      )}
    </section>
  );
}
