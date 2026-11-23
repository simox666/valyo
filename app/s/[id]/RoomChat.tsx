"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { ReportButton } from "@/components/ReportButton";
import { LocalTime } from "@/components/LocalTime";
import { MentionText } from "@/components/MentionText";
import { MentionTextarea } from "@/components/MentionTextarea";
import type { MessageView } from "@/lib/rooms/chat.ts";
import { VoiceRecorder } from "./VoiceRecorder";

export type ChatMessage = MessageView;
interface Pending { clientId: string; body: string; state: "envoi" | "echec" }

/** React échappe le texte ; seules les URL http(s) et les mentions @pseudo deviennent des liens. */
function MessageBody({ body }: { body: string }) {
  return <p className="whitespace-pre-wrap break-words">{body.split(/(https?:\/\/[^\s<>"']+)/gi).map((part, i) => {
    if (!/^https?:\/\//i.test(part)) return <MentionText key={i} text={part} />;
    const url = part.replace(/[.,!?;:]+$/, "");
    return <span key={i}><a href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn-link break-all">{url}</a>{part.slice(url.length)}</span>;
  })}</p>;
}

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** Lecteur d'un message vocal. Rien n'est téléchargé avant que l'on appuie sur lecture. */
function VoiceMessage({ roomId, audio }: { roomId: string; audio: { id: string; durationMs: number } }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
    <audio controls preload="none" src={`/api/rooms/${roomId}/audio/${audio.id}`} className="h-10 w-full max-w-xs" aria-label={`Message vocal de ${clock(audio.durationMs)}`} />
    <span className="font-mono text-xs text-soft">Vocal · {clock(audio.durationMs)}</span>
  </div>;
}

export function RoomChat({ roomId, initialMessages, initialCursor, initialHasMore, lastReadSeq, viewerId, canWrite, canModerate }: {
  roomId: string; initialMessages: ChatMessage[]; initialCursor: number; initialHasMore: boolean;
  lastReadSeq: number; viewerId: string; canWrite: boolean; canModerate: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const messagesRef = useRef(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<"connexion" | "en direct" | "reconnexion" | "acces retire">("connexion");
  const [notice, setNotice] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [newMessages, setNewMessages] = useState(0);
  const [localDates, setLocalDates] = useState(false);
  const cursorRef = useRef(initialCursor);
  const readSentRef = useRef(lastReadSeq);
  const epoch = useRef(0);
  const revoked = useRef(false);
  const sourceRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const followsBottom = useRef(true);
  const bottomVisible = useRef(false);
  const anchor = useRef<{ top: number; height: number } | null>(null);
  const [readTick, setReadTick] = useState(0);
  const writable = canWrite && !archived && connection !== "acces retire";

  const replaceMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const revoke = useCallback(() => {
    if (revoked.current) return;
    revoked.current = true;
    epoch.current++;
    sourceRef.current?.close();
    replaceMessages([]);
    setPending([]);
    setDraft("");
    setEditing(null);
    setHasMore(false);
    setNewMessages(0);
    setConnection("acces retire");
    setNotice("Votre accès à cette discussion a été retiré.");
    router.refresh(); // retire également membres, invitations et autres métadonnées privées
  }, [replaceMessages, router]);

  const upsert = useCallback((message: ChatMessage) => {
    if (revoked.current) return;
    const exists = messagesRef.current.some((m) => m.id === message.id);
    if (!exists && message.authorId !== viewerId && (!followsBottom.current || document.visibilityState !== "visible")) {
      setNewMessages((n) => n + 1);
    }
    replaceMessages([...messagesRef.current.filter((m) => m.id !== message.id), message].sort((a, b) => a.seq - b.seq));
  }, [replaceMessages, viewerId]);

  const reloadSnapshot = useCallback(async () => {
    const requestEpoch = epoch.current;
    const result = await api("GET", `/api/rooms/${roomId}/messages`);
    if (requestEpoch !== epoch.current || revoked.current) return false;
    if ([401, 403, 404].includes(result.status)) { revoke(); return false; }
    if (!result.ok || !Number.isSafeInteger(result.data.cursor)) return false;
    cursorRef.current = Number(result.data.cursor);
    replaceMessages(result.data.messages as ChatMessage[]);
    setHasMore(Boolean(result.data.hasMore));
    return true;
  }, [roomId, replaceMessages, revoke]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = 1000;
    function later() {
      if (stopped || revoked.current) return;
      clearTimeout(timer);
      timer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15000);
    }
    function connect() {
      if (stopped || revoked.current) return;
      const source = new EventSource(`/api/rooms/${roomId}/stream?cursor=${cursorRef.current}`);
      sourceRef.current = source;
      const current = () => !stopped && !revoked.current && sourceRef.current === source;
      const onMessage = (e: MessageEvent) => {
        if (!current()) return;
        const data = JSON.parse(e.data) as { seq: number; message: ChatMessage | null };
        cursorRef.current = Math.max(cursorRef.current, data.seq);
        if (data.message) upsert(data.message);
      };
      for (const kind of ["message", "edit", "delete"]) source.addEventListener(kind, onMessage);
      source.addEventListener("ready", () => {
        if (current()) { retryMs = 1000; setConnection("en direct"); }
      });
      source.addEventListener("battement", (e) => {
        if (!current()) return;
        const data = JSON.parse((e as MessageEvent).data) as { cursor: number; archived: boolean };
        cursorRef.current = Math.max(cursorRef.current, data.cursor);
        setArchived(data.archived);
      });
      source.addEventListener("resync", async () => {
        if (!current()) return;
        source.close();
        sourceRef.current = null;
        setConnection("reconnexion");
        // Le curseur de la réponse d'historique est la référence, pas l'ancien curseur SSE.
        const ok = await reloadSnapshot();
        if (stopped || revoked.current) return;
        if (ok) connect(); else later();
      });
      source.addEventListener("revoked", () => { if (current()) revoke(); });
      source.addEventListener("fin", () => {
        if (!current()) return;
        source.close();
        sourceRef.current = null;
        connect();
      });
      source.onerror = async () => {
        if (!current()) return;
        source.close();
        sourceRef.current = null;
        setConnection("reconnexion");
        // Une reconnexion refusée (401/404) doit aussi vider l'interface.
        const result = await api("GET", `/api/rooms/${roomId}/messages?before=1`);
        if (stopped || revoked.current) return;
        if ([401, 403, 404].includes(result.status)) revoke(); else later();
      };
    }
    connect();
    return () => { stopped = true; epoch.current++; clearTimeout(timer); sourceRef.current?.close(); };
  }, [roomId, reloadSnapshot, upsert, revoke]);

  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    if (anchor.current) {
      box.scrollTop = anchor.current.top + box.scrollHeight - anchor.current.height;
      anchor.current = null;
    } else if (followsBottom.current) box.scrollTop = box.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    setLocalDates(true);
    const onVisibility = () => setReadTick((n) => n + 1);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new IntersectionObserver(([entry]) => {
      bottomVisible.current = entry.isIntersecting;
      onVisibility();
    }, { threshold: 1 });
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const maxSeq = messages.at(-1)?.seq ?? 0;
  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    async function record() {
      if (stopped || revoked.current || document.visibilityState !== "visible" || !bottomVisible.current || !followsBottom.current || maxSeq <= readSentRef.current) return;
      const result = await api("POST", `/api/rooms/${roomId}/read`, { seq: maxSeq });
      if (stopped || revoked.current) return;
      if (result.ok) {
        readSentRef.current = Math.max(readSentRef.current, Number(result.data.lastReadSeq));
        setNewMessages(0);
        window.dispatchEvent(new Event("valyo:notifications"));
      } else if ([401, 403, 404].includes(result.status)) revoke();
      else retry = setTimeout(record, 3000); // aucun acquittement local avant succès serveur
    }
    void record();
    return () => { stopped = true; clearTimeout(retry); };
  }, [maxSeq, readTick, roomId, revoke]);

  async function older() {
    if (loadingHistory || !hasMore || revoked.current) return;
    setLoadingHistory(true);
    const requestEpoch = epoch.current;
    const result = await api("GET", `/api/rooms/${roomId}/messages?before=${messagesRef.current[0]?.seq ?? 0}`);
    setLoadingHistory(false);
    if (requestEpoch !== epoch.current || revoked.current) return;
    if ([401, 403, 404].includes(result.status)) { revoke(); return; }
    if (!result.ok) { setNotice(result.data.error ?? "Historique indisponible."); return; }
    const box = scrollRef.current;
    if (box) anchor.current = { top: box.scrollTop, height: box.scrollHeight };
    followsBottom.current = false;
    const byId = new Map((result.data.messages as ChatMessage[]).map((m) => [m.id, m]));
    // Les événements reçus pendant la requête priment sur l'ancienne page d'historique.
    for (const message of messagesRef.current) byId.set(message.id, message);
    replaceMessages([...byId.values()].sort((a, b) => a.seq - b.seq));
    setHasMore(Boolean(result.data.hasMore));
  }

  async function send(clientId: string, body: string) {
    if (!writable || revoked.current) return;
    const requestEpoch = epoch.current;
    setPending((items) => [...items.filter((p) => p.clientId !== clientId), { clientId, body, state: "envoi" }]);
    const result = await api("POST", `/api/rooms/${roomId}/messages`, { clientId, body });
    if (requestEpoch !== epoch.current || revoked.current) return;
    if ([401, 403, 404].includes(result.status)) { revoke(); return; }
    if (result.ok) {
      setPending((items) => items.filter((p) => p.clientId !== clientId));
      upsert(result.data.message as ChatMessage);
    } else {
      setPending((items) => items.map((p) => p.clientId === clientId ? { ...p, state: "echec" } : p));
      setNotice(result.data.error ?? "Envoi impossible.");
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !writable || body.length > 2000) return;
    setDraft("");
    setNotice(null);
    void send(crypto.randomUUID(), body);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || saving || !writable) return;
    const requestEpoch = epoch.current;
    setSaving(true);
    const result = await api("PATCH", `/api/rooms/${roomId}/messages/${editing.id}`, { body: editing.body });
    setSaving(false);
    if (requestEpoch !== epoch.current || revoked.current) return;
    if (result.ok) setEditing(null);
    else if ([401, 403, 404].includes(result.status)) {
      // Un message supprimé n'est pas une révocation du salon ; revérifier son accès.
      if (!(await reloadSnapshot())) setNotice(result.data.error ?? "Modification impossible.");
    } else setNotice(result.data.error ?? "Modification impossible. Votre saisie est conservée.");
  }

  async function removeMessage(message: ChatMessage) {
    if (!writable || revoked.current) return;
    const own = message.authorId === viewerId;
    if (!confirm(own ? "Supprimer ce message ?" : "Retirer ce message de la discussion ?")) return;
    const reason = own ? undefined : prompt("Motif du retrait (enregistré) :");
    if (!own && !reason) return;
    const requestEpoch = epoch.current;
    const result = await api("DELETE", `/api/rooms/${roomId}/messages/${message.id}`, reason ? { reason } : {});
    if (requestEpoch === epoch.current && !revoked.current && !result.ok) setNotice(result.data.error ?? "Suppression impossible.");
  }

  const firstUnread = messages.find((m) => m.seq > lastReadSeq && m.authorId !== viewerId)?.seq;
  const day = (m: ChatMessage) => localDates ? new Date(m.createdAt).toLocaleDateString("fr-BE", { dateStyle: "long" }) : m.createdAt.slice(0, 10);
  return <div className="min-w-0">
    <p className="flex items-center gap-2 text-xs text-neutral-500" role="status"><span aria-hidden className={`h-1.5 w-1.5 rounded-full ${connection === "en direct" ? "bg-accent" : "bg-neutral-400"}`} />{connection === "en direct" ? "Discussion en direct" : connection === "reconnexion" ? "Reconnexion en cours…" : connection === "acces retire" ? "Accès retiré" : "Connexion…"}</p>
    {archived && <p className="mt-2 text-sm">Salon archivé : la discussion reste consultable.</p>}
    <div ref={scrollRef} className="mt-3 h-[min(52dvh,34rem)] min-h-56 overflow-y-auto overscroll-contain rounded-xl bg-paper p-3 sm:p-4" tabIndex={0} role="region" aria-label="Historique de la discussion" onScroll={() => {
      const box = scrollRef.current;
      if (!box) return;
      followsBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 32;
      if (followsBottom.current) { setNewMessages(0); setReadTick((n) => n + 1); }
    }}>
      {hasMore && <button type="button" disabled={loadingHistory} className="btn-secondary mb-4 w-full" onClick={older}>{loadingHistory ? "Chargement…" : "Charger les messages précédents"}</button>}
      <ol className="space-y-3">
        {messages.map((m, i) => <li key={m.id} id={`message-${m.id}`} className="min-w-0">
          {(i === 0 || day(messages[i - 1]) !== day(m)) && <p className="my-3 border-b border-line pb-2 text-center text-xs text-soft">{day(m)}</p>}
          {m.seq === firstUnread && <p className="mb-2 border-t-2 border-accent pt-2 text-xs font-bold text-accent">Nouveaux messages</p>}
          <div className={`group max-w-[94%] rounded-2xl px-3 py-2.5 sm:max-w-[88%] sm:px-4 ${m.authorId === viewerId ? "ml-auto rounded-br-sm bg-accent-soft" : "rounded-bl-sm border border-line bg-white"}`}>
          <p className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"><span className="font-semibold">{m.authorName}</span>{" "}<span className="text-xs text-soft"><LocalTime iso={m.createdAt} mode="time" />{m.editedAt && !m.deleted && " · modifié"}</span></p>
          {m.deleted ? <p className="italic text-neutral-500">{m.removedByModeration ? "Message retiré par la modération." : "Message supprimé par son auteur."}</p> : editing?.id === m.id ? <form onSubmit={saveEdit} className="mt-2 space-y-2">
            <label className="label" htmlFor={`edit-${m.id}`}>Modifier votre message</label>
            <MentionTextarea id={`edit-${m.id}`} className="field" value={editing.body} onValueChange={(body) => setEditing({ id: m.id, body })} room={roomId} maxLength={2000} required rows={3} />
            <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={saving || !editing.body.trim()}>Enregistrer</button><button type="button" className="btn-link" onClick={() => setEditing(null)}>Annuler</button></div>
          </form> : m.audio ? <VoiceMessage roomId={roomId} audio={m.audio} /> : <MessageBody body={m.body ?? ""} />}
          {/* Audit UX (P2-6) : actions au survol en ordinateur ; toujours visibles au tactile (pas de survol). */}
          {!m.deleted && writable && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
            {m.authorId === viewerId && !m.audio && <button type="button" className="btn-link" onClick={() => { setEditing({ id: m.id, body: m.body ?? "" }); setNotice(null); }}>Modifier</button>}
            {(m.authorId === viewerId || canModerate) && <button type="button" className="btn-link" onClick={() => removeMessage(m)}>{m.authorId === viewerId ? "Supprimer" : "Retirer (modération)"}</button>}
            {m.authorId !== viewerId && <ReportButton targetKind="message" targetId={m.id} />}
          </div>}
          </div>
        </li>)}
        {pending.map((p) => <li key={p.clientId} className="opacity-70"><p className="text-sm font-semibold">Vous · {p.state === "envoi" ? "envoi en cours…" : "échec de l’envoi"}</p><MessageBody body={p.body} />{p.state === "echec" && <button type="button" className="btn-link" onClick={() => send(p.clientId, p.body)}>Relancer sans doublon</button>}</li>)}
        {!messages.length && !pending.length && <li className="text-neutral-600">{revoked.current ? "Discussion indisponible." : "Aucun message pour l’instant."}</li>}
      </ol>
      <div ref={bottomRef} className="h-px" />
    </div>
    {newMessages > 0 && <button type="button" className="btn-secondary mt-2 w-full" onClick={() => {
      followsBottom.current = true;
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setNewMessages(0); setReadTick((n) => n + 1);
    }}>{newMessages} nouveau{newMessages > 1 ? "x" : ""} message{newMessages > 1 ? "s" : ""} — aller en bas</button>}
    {notice && <p role="alert" className="error-text mt-2">{notice}</p>}
    {writable && <form onSubmit={submit} className="mt-4 space-y-2 rounded-xl border border-line bg-white p-3">
      <label className="label" htmlFor={`compose-${roomId}`}>Votre message</label>
      <MentionTextarea id={`compose-${roomId}`} value={draft} onValueChange={setDraft} room={roomId} maxLength={2000} rows={2} placeholder="Partagez une idée, posez une question…" className="field w-full resize-y border-0 bg-paper" aria-describedby={`hint-${roomId}`} onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
      }} />
      <div className="flex flex-wrap items-center justify-between gap-2"><p id={`hint-${roomId}`} className="text-xs text-neutral-500">Entrée : envoyer · Maj+Entrée : nouvelle ligne · 2 000 caractères maximum{draft.length >= 1800 && ` (${draft.length}/2 000)`}</p><button type="submit" className="btn-primary" disabled={!draft.trim()}>Envoyer</button></div>
      <VoiceRecorder roomId={roomId} onSent={upsert} onError={setNotice} />
    </form>}
  </div>;
}
