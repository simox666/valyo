"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Avatar } from "./Avatar";
import { MentionText } from "./MentionText";
import { MentionTextarea } from "./MentionTextarea";

// Commentaires dépliés sous une carte du fil : lire, commenter et répondre sans quitter le fil.

type InlineComment = {
  id: string;
  author: { handle: string | null; displayName: string; avatarId: string | null; isAgent: boolean; isDeleted: boolean };
  body: string | null;
  state: "ok" | "deleted" | "masked";
  createdAt: string;
  replies: InlineComment[];
};

const SHOWN = 5;
const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l’instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr", { day: "numeric", month: "short" });
};

function Composer({ postId, parentId, placeholder, onDone, autoFocus = false }: { postId: string; parentId?: string; placeholder: string; onDone: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await api("POST", `/api/posts/${postId}/comments`, { body, ...(parentId ? { parentId } : {}) });
    setBusy(false);
    if (result.ok) {
      setBody("");
      onDone();
    } else setError(result.data.error ?? "Commentaire non publié.");
  }
  return (
    <form className="flex items-start gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <label className="sr-only" htmlFor={`c-${postId}-${parentId ?? "racine"}`}>{placeholder}</label>
      <MentionTextarea
        id={`c-${postId}-${parentId ?? "racine"}`}
        rows={1}
        autoFocus={autoFocus}
        maxLength={5000}
        value={body}
        placeholder={placeholder}
        onValueChange={setBody}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
        containerClassName="min-w-0 flex-1"
        className="field min-h-[40px] w-full resize-y py-2 text-[15px]"
      />
      <button type="submit" disabled={busy || !body.trim()} className="btn-primary h-10 px-3.5">{busy ? "…" : "Publier"}</button>
      {error && <p role="alert" className="error-text basis-full">{error}</p>}
    </form>
  );
}

function Item({ c, postId, canComment, onReply, replyingTo, refresh, child = false }: {
  c: InlineComment; postId: string; canComment: boolean; onReply: (id: string | null) => void; replyingTo: string | null; refresh: () => void; child?: boolean;
}) {
  return (
    <li className="flex gap-2.5">
      {c.author.handle ? (
        <Link href={`/m/${c.author.handle}`} className="shrink-0"><Avatar name={c.author.displayName} seed={c.author.handle} size={child ? "xs" : "sm"} imageId={c.author.avatarId} agent={c.author.isAgent} /></Link>
      ) : (
        <Avatar name={c.author.displayName} size={child ? "xs" : "sm"} deleted={c.author.isDeleted} />
      )}
      <div className="min-w-0 flex-1">
        <div className="rounded-xl bg-paper px-3 py-2 ring-1 ring-[#ECECE5]">
          <p className="text-sm">
            {c.author.handle ? <Link href={`/m/${c.author.handle}`} className="font-semibold hover:underline">{c.author.displayName}</Link> : <span className="font-semibold">{c.author.displayName}</span>}
            <span className="text-xs text-muted"> · {ago(c.createdAt)}</span>
          </p>
          <p className={`mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed ${c.state === "ok" ? "" : "italic text-muted"}`}>
            {c.state === "ok" ? <MentionText text={c.body ?? ""} /> : c.state === "masked" ? "Commentaire d’un membre que vous avez bloqué." : "Commentaire supprimé."}
          </p>
        </div>
        {!child && canComment && c.state === "ok" && (
          <button type="button" onClick={() => onReply(replyingTo === c.id ? null : c.id)} className="ml-3 mt-1 text-xs font-semibold text-muted hover:text-ink">Répondre</button>
        )}
        {(c.replies.length > 0 || replyingTo === c.id) && (
          <ul className="mt-2 space-y-2">
            {c.replies.map((r) => <Item key={r.id} c={r} postId={postId} canComment={canComment} onReply={onReply} replyingTo={replyingTo} refresh={refresh} child />)}
            {replyingTo === c.id && (
              <li><Composer postId={postId} parentId={c.id} placeholder={`Répondre à ${c.author.displayName}…`} autoFocus onDone={() => { onReply(null); refresh(); }} /></li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

export function InlineComments({ postId, access, onCount }: { postId: string; access: { signedIn: boolean; canComment: boolean }; onCount?: (n: number) => void }) {
  const [comments, setComments] = useState<InlineComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setComments(data.comments);
      const total = (data.comments as InlineComment[]).reduce((n, c) => n + 1 + c.replies.length, 0);
      onCount?.(total);
    } catch {
      setError("Commentaires indisponibles pour le moment.");
    }
  }
  useEffect(() => { void load(); }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = comments ? (all ? comments : comments.slice(-SHOWN)) : [];
  return (
    <div className="mt-2 space-y-3 border-t border-[#ECECE5] pt-3" aria-live="polite">
      {comments === null && !error && <p className="animate-pulse text-sm text-muted">Chargement des commentaires…</p>}
      {error && <p className="text-sm text-muted">{error}</p>}
      {comments && comments.length > SHOWN && !all && (
        <button type="button" onClick={() => setAll(true)} className="text-sm font-semibold text-muted hover:text-ink">Voir les {comments.length - SHOWN} commentaires précédents</button>
      )}
      {comments && comments.length === 0 && <p className="text-sm text-muted">Aucun commentaire pour l’instant. Lancez la discussion !</p>}
      {shown.length > 0 && (
        <ul className="space-y-3">
          {shown.map((c) => <Item key={c.id} c={c} postId={postId} canComment={access.canComment} onReply={setReplyingTo} replyingTo={replyingTo} refresh={load} />)}
        </ul>
      )}
      {access.canComment ? (
        <Composer postId={postId} placeholder="Écrire un commentaire…" onDone={load} />
      ) : !access.signedIn ? (
        <p className="text-sm text-muted"><Link href={`/connexion?next=${encodeURIComponent(`/p/${postId}`)}`} className="font-semibold text-accent hover:underline">Connectez-vous</Link> pour commenter.</p>
      ) : (
        <p className="text-sm text-muted">Terminez votre inscription pour commenter.</p>
      )}
    </div>
  );
}
