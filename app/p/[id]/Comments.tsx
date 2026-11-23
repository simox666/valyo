"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api, loginUrl } from "@/lib/client";
import type { Comment } from "@/lib/data/comments";
import { AuthorName } from "@/components/AuthorName";
import { LocalTime } from "@/components/LocalTime";
import { MentionText } from "@/components/MentionText";
import { MentionTextarea } from "@/components/MentionTextarea";

type Viewer = { id: string; canContribute: boolean } | null;
/** Présent uniquement sous une publication de type « question ». */
type Question = { postAuthorId: string; bestCommentId: string | null } | null;

function CommentForm({
  postId,
  parentId,
  onDone,
  autoFocus,
  label,
}: {
  postId: string;
  parentId?: string;
  onDone?: () => void;
  autoFocus?: boolean;
  label: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `comment-${parentId ?? "root"}`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api("POST", `/api/posts/${postId}/comments`, { body, parentId });
    setBusy(false);
    if (result.ok) {
      setBody("");
      onDone?.();
      router.refresh();
    } else {
      setError(result.data.fields?.body ?? result.data.error ?? "Envoi impossible.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <MentionTextarea
        id={id}
        rows={parentId ? 1 : 2}
        value={body}
        autoFocus={autoFocus}
        onValueChange={setBody}
        placeholder={label}
        containerClassName="min-w-0 flex-1"
        className={`field min-h-[44px] w-full resize-y py-2 text-[15px] ${error ? "field-invalid" : ""}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !body.trim()} className="btn-primary h-11">
          {busy ? "Envoi…" : "Publier"}
        </button>
        {onDone && (
          <button type="button" className="btn-secondary" onClick={onDone}>
            Annuler
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="error-text basis-full">
          {error}
        </p>
      )}
    </form>
  );
}

function CommentItem({ comment, postId, viewer, isReply, question }: { comment: Comment; postId: string; viewer: Viewer; isReply?: boolean; question?: Question }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "reply" | "confirm-delete">("view");
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwn = viewer?.id === comment.authorId && !comment.isDeleted;
  const isBest = question?.bestCommentId === comment.id && !comment.isDeleted;
  // Choix réservé à l'auteur de la question, sur les commentaires de premier niveau des autres.
  const canPick = Boolean(question && viewer?.canContribute && viewer.id === question.postAuthorId && !isReply && !isOwn && !comment.isDeleted && !comment.isMasked);

  async function pickBest(commentId: string | null) {
    setBusy(true);
    setError(null);
    const result = await api("POST", `/api/posts/${postId}/meilleure-reponse`, { commentId });
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.data.error ?? "Action impossible.");
  }

  async function save() {
    setBusy(true);
    setError(null);
    const result = await api("PATCH", `/api/comments/${comment.id}`, { body: draft });
    setBusy(false);
    if (result.ok) {
      setMode("view");
      router.refresh();
    } else setError(result.data.fields?.body ?? result.data.error ?? "Modification impossible.");
  }

  async function remove() {
    setBusy(true);
    const result = await api("DELETE", `/api/comments/${comment.id}`);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.data.error ?? "Suppression impossible.");
  }

  return (
    <div className={isReply ? "border-l-2 border-line pl-4" : isBest ? "-mx-2 rounded-lg bg-success-soft px-2 ring-1 ring-success-line" : ""}>
      {isBest && (
        <p className="flex items-center gap-1.5 pt-2 text-xs font-bold text-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m4.5 12.5 5 5 10-11" /></svg>
          Meilleure réponse · retenue par l’auteur de la question
        </p>
      )}
      {comment.isDeleted ? (
        <p className="py-2 italic text-muted">Commentaire supprimé</p>
      ) : comment.isMasked ? (
        <p className="py-2 italic text-muted">Commentaire masqué (membre que vous avez bloqué)</p>
      ) : (
        <div className="py-2">
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-soft">
            <AuthorName author={comment.author} />
            <span aria-hidden>·</span>
            <LocalTime iso={comment.createdAt} />
            {comment.editedAt && <span className="italic">(modifié)</span>}
          </div>
          {mode === "edit" ? (
            <div className="mt-2 space-y-2">
              <label htmlFor={`edit-${comment.id}`} className="sr-only">
                Modifier le commentaire
              </label>
              <MentionTextarea id={`edit-${comment.id}`} rows={3} value={draft} onValueChange={setDraft} className="field" autoFocus />
              <div className="flex gap-2">
                <button type="button" className="btn-primary" disabled={busy || !draft.trim()} onClick={save}>
                  Enregistrer
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setDraft(comment.body); setMode("view"); }}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap leading-relaxed"><MentionText text={comment.body} /></p>
          )}
          {mode !== "edit" && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
              {!isReply && viewer?.canContribute && (
                <button type="button" className="btn-link" onClick={() => setMode(mode === "reply" ? "view" : "reply")}>
                  Répondre
                </button>
              )}
              {canPick && (
                <button type="button" className={`font-semibold underline-offset-2 hover:underline ${isBest ? "text-muted" : "text-success"}`} disabled={busy} onClick={() => pickBest(isBest ? null : comment.id)}>
                  {isBest ? "Retirer la meilleure réponse" : "✓ Retenir comme meilleure réponse"}
                </button>
              )}
              {isOwn && viewer?.canContribute && (
                <>
                  <button type="button" className="btn-link" onClick={() => setMode("edit")}>
                    Modifier
                  </button>
                  {mode === "confirm-delete" ? (
                    <span role="alertdialog" aria-label="Confirmer la suppression" className="inline-flex flex-wrap items-center gap-2">
                      <span>Supprimer ce commentaire ?</span>
                      <button type="button" className="btn-link text-red-700" disabled={busy} onClick={remove} autoFocus>
                        Oui, supprimer
                      </button>
                      <button type="button" className="btn-link" onClick={() => setMode("view")}>
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn-link text-red-700" onClick={() => setMode("confirm-delete")}>
                      Supprimer
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </div>
      )}
      {mode === "reply" && (
        <div className="mb-3 ml-4">
          <CommentForm postId={postId} parentId={comment.id} onDone={() => setMode("view")} autoFocus label={`Répondre à ${comment.author.displayName}`} />
        </div>
      )}
      {comment.replies.length > 0 && (
        <div className="ml-2 space-y-1">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} postId={postId} viewer={viewer} isReply />
          ))}
        </div>
      )}
    </div>
  );
}

export function Comments({ postId, comments, viewer, question = null }: { postId: string; comments: Comment[]; viewer: Viewer; question?: Question }) {
  const pathname = usePathname();
  // La meilleure réponse d'une question s'affiche en tête, le reste garde l'ordre chronologique.
  const ordered = question?.bestCommentId
    ? [...comments.filter((c) => c.id === question.bestCommentId), ...comments.filter((c) => c.id !== question.bestCommentId)]
    : comments;
  return (
    <div className="space-y-4">
      {viewer?.canContribute ? (
        <CommentForm postId={postId} label="Écrire un commentaire…" />
      ) : viewer ? (
        <p className="card p-4 text-soft">
          <Link href={`/bienvenue?next=${encodeURIComponent(pathname)}`} className="btn-link">
            Terminez votre inscription
          </Link>{" "}
          pour commenter.
        </p>
      ) : (
        <p className="card p-4 text-soft">
          <Link href={loginUrl(`${pathname}#commentaires`)} className="btn-link">
            Connectez-vous
          </Link>{" "}
          pour commenter. Vous reviendrez ensuite sur cette publication.
        </p>
      )}
      {comments.length === 0 ? (
        // Visiteur : l'invitation à se connecter ci-dessus suffit, pas de second état vide.
        viewer?.canContribute ? <p className="text-soft">Aucun commentaire pour l’instant. Lancez la discussion !</p> : null
      ) : (
        <div className="card divide-y divide-line px-4">
          {ordered.map((comment) => (
            <CommentItem key={comment.id} comment={comment} postId={postId} viewer={viewer} question={question} />
          ))}
        </div>
      )}
    </div>
  );
}
