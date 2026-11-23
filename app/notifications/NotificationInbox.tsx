"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { LocalTime } from "@/components/LocalTime";
import type { NotificationView } from "@/lib/social/notifications.ts";

const filters = [["all", "Tout"], ["unread", "Non lues"], ["reply", "Réponses"], ["mention", "Mentions"], ["room_message", "Salons"], ["moderation", "Modération"]] as const;
type Filter = typeof filters[number][0];

export function NotificationInbox({ initialNotifications, canMark }: { initialNotifications: NotificationView[]; canMark: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initialNotifications);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setItems(initialNotifications); }, [initialNotifications]);
  const visible = items.filter(n => filter === "all" || (filter === "unread" ? !n.read : filter === "reply" ? n.kind === "reply" || n.kind === "best_answer" : n.kind === filter));
  async function markRead(id: string) {
    setBusy(id); setError(null);
    const result = await api("POST", "/api/notifications", { ids: [id] });
    setBusy(null);
    if (!result.ok) { setError(result.data.error ?? "La notification n’a pas pu être marquée comme lue."); return; }
    setItems(old => old.map(n => n.id === id ? { ...n, read: true } : n));
    window.dispatchEvent(new Event("valyo:notifications")); router.refresh();
  }
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les notifications">
      {filters.map(([key, label]) => <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} className={`rounded-full border px-3 py-2 text-sm font-semibold ${filter === key ? "border-accent bg-accent text-white" : "border-line bg-white text-soft hover:bg-chip"}`}>{label}</button>)}
    </div>
    {error && <p role="alert" className="error-text">{error}</p>}
    <p role="status" className="text-xs text-muted">{visible.length} notification{visible.length > 1 ? "s" : ""} affichée{visible.length > 1 ? "s" : ""} · jusqu’à 50 notifications chargées</p>
    {visible.length ? <ul className="space-y-3">{visible.map(n => {
      const title = n.kind === "reply" ? "Une réponse à votre contribution" : n.kind === "mention" ? "On parle de vous" : n.kind === "best_answer" ? "Votre réponse a été retenue" : n.kind === "relay" ? "Votre publication est relayée" : n.kind === "room_message" ? "La discussion continue" : "Décision de modération";
      const destination = n.kind === "moderation" ? "/sanctions"
        : n.kind === "relay" && n.postId ? `/p/${n.postId}`
        : (n.kind === "reply" || n.kind === "best_answer") && n.postId ? `/p/${n.postId}#commentaires`
        : n.kind === "mention" ? (n.postId ? `/p/${n.postId}#commentaires` : n.roomId ? `/s/${n.roomId}#chat` : null)
        : n.kind === "room_message" && n.roomId ? `/s/${n.roomId}#chat` : null;
      return <li key={n.id} className={`card relative overflow-hidden p-4 sm:p-5 ${!n.read ? "border-l-4 border-l-accent" : "bg-paper"}`}>
        <div className="flex items-start gap-3">
          <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-lg font-bold ${n.kind === "moderation" ? "bg-amber-50 text-amber-800" : n.kind === "best_answer" ? "bg-success-soft text-success" : "bg-accent-soft text-accent"}`}>{n.kind === "reply" ? "↩" : n.kind === "mention" ? "@" : n.kind === "best_answer" ? "✓" : n.kind === "relay" ? "⇄" : n.kind === "room_message" ? "#" : "!"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold">{title}</h2>{!n.read && <span className="chip bg-accent-soft text-accent">Non lue</span>}</div>
            <p className="mt-2 text-sm leading-relaxed text-soft">{n.kind === "moderation" ? n.body
              : n.kind === "reply" ? <><span className="font-semibold">{n.actorName ?? "Un membre"}</span> a répondu{n.postTitle ? <> sur « {n.postTitle} »</> : " à votre contribution"}.</>
              : n.kind === "mention" ? <><span className="font-semibold">{n.actorName ?? "Un membre"}</span> vous a mentionné{n.postTitle ? <> sur « {n.postTitle} »</> : n.roomName ? <> dans le salon <span className="font-semibold">{n.roomName}</span></> : null}.</>
              : n.kind === "best_answer" ? <><span className="font-semibold">{n.actorName ?? "Un membre"}</span> a retenu votre réponse comme meilleure réponse{n.postTitle ? <> à « {n.postTitle} »</> : null}. Elle s’affiche en tête, et compte dans votre progression.</>
              : n.kind === "relay" ? <><span className="font-semibold">{n.actorName ?? "Un membre"}</span> a relayé{n.postTitle ? <> « {n.postTitle} »</> : " votre publication"} à ses abonnés.</>
              : <>{n.count > 1 ? `${n.count} nouveaux messages` : "Un nouveau message"} dans <span className="font-semibold">{n.roomName ?? "un salon suivi"}</span>.</>}</p>
            <p className="mt-2 text-xs text-muted"><LocalTime iso={n.updatedAt} mode="full" /></p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">{destination && <Link href={destination} className="btn-link">{n.kind === "moderation" ? "Voir la décision et contester" : n.kind === "reply" ? "Lire la réponse" : n.kind === "mention" ? "Voir où l’on parle de vous" : n.kind === "best_answer" ? "Voir votre réponse en tête" : n.kind === "relay" ? "Voir la publication" : "Ouvrir la discussion"} →</Link>}{!n.read && canMark && <button type="button" disabled={busy !== null} onClick={() => markRead(n.id)} className="text-xs font-semibold text-muted underline-offset-2 hover:underline disabled:opacity-50">{busy === n.id ? "Enregistrement…" : "Marquer comme lue"}</button>}</div>
          </div>
        </div>
      </li>;
    })}</ul> : <div className="card px-5 py-12 text-center"><p className="text-xl font-bold">{filter === "unread" ? "Vous êtes à jour." : "Rien ici pour le moment."}</p><p className="mx-auto mt-3 max-w-md text-sm text-soft">{filter === "all" ? "Les réponses à vos publications et l’activité des salons que vous suivez apparaîtront ici." : "Les notifications de cette catégorie apparaîtront ici."}</p><Link href="/salons" className="btn-secondary mt-5">Retrouver les discussions</Link></div>}
  </div>;
}
