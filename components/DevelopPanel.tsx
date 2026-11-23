"use client";

import { ListenButton } from "./ListenButton";
import { synthesisSpeech } from "@/lib/lecture.ts";
import Link from "next/link";
import { useState } from "react";
import type { SynthesisState } from "@/lib/actus/synthesis.ts";
import { Icon } from "./Icon";
import { InlineComments } from "./InlineComments";
import { RoomsPopover } from "./RoomsPopover";

// Volet « Développer » : synthèse IA de l'article source (l'essentiel, points clés, contexte,
// limites). Générée une fois à la première demande d'un membre, puis montrée à tous.

type Access = { signedIn: boolean; canDevelop: boolean };

function useSynthesis(postId: string, initial: SynthesisState) {
  const [state, setState] = useState<SynthesisState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function develop() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      for (let attempt = 0; attempt < 40; attempt++) {
        const res = await fetch(`/api/posts/${postId}/synthese`, { method: attempt ? "GET" : "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "La synthèse n’a pas pu être générée.");
          return;
        }
        setState(data);
        if (data.status !== "pending") return;
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch {
      setError("Connexion interrompue. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return { state, busy, error, develop };
}

const needsRun = (s: SynthesisState) => s.status === "none" || s.status === "failed" || s.status === "pending";

function SynthesisView({ postId, s, access, roomHref, naturalVoice }: { postId: string; s: ReturnType<typeof useSynthesis>; access: Access; roomHref: string; naturalVoice?: boolean }) {
  const { state, busy, error } = s;
  return (
    <div className="rounded-lg border-l-2 border-accent bg-cream p-4 text-[15px] leading-relaxed ring-1 ring-hairline sm:p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-mono text-accent">Synthèse IA de l’article</p>
        {state.status === "ready" && <ListenButton text={synthesisSpeech(state.content)} lang="fr" src={naturalVoice ? `/api/posts/${postId}/lecture?type=synthese` : undefined} />}
      </div>
      {state.status === "ready" ? (
        <div className="mt-2 space-y-3">
          <p className="font-medium text-ink">{state.content.essentiel}</p>
          {state.content.points.length > 0 && (
            <div>
              <h3 className="label-mono">À retenir</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {state.content.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {state.content.contexte && (
            <div>
              <h3 className="label-mono">Pourquoi c’est important</h3>
              <p className="mt-1">{state.content.contexte}</p>
            </div>
          )}
          {state.content.limites && (
            <div>
              <h3 className="label-mono">Ce qui reste à confirmer</h3>
              <p className="mt-1">{state.content.limites}</p>
            </div>
          )}
          <p className="text-xs text-muted">Résumé généré par IA à partir de l’article : il peut contenir des erreurs, l’article d’origine fait foi.</p>
          <Link href={roomHref} className="btn-primary inline-flex">En discuter dans un salon</Link>
        </div>
      ) : busy || state.status === "pending" ? (
        <p className="mt-2 animate-pulse text-sm text-muted">L’IA lit l’article et prépare la synthèse…</p>
      ) : state.status === "unavailable" ? (
        <p className="mt-2 text-muted">{state.message}</p>
      ) : !access.signedIn ? (
        <p className="mt-2 text-muted">
          <Link href={`/connexion?next=${encodeURIComponent(`/p/${postId}`)}`} className="btn-link">Connectez-vous</Link> pour obtenir la synthèse IA de cet article.
        </p>
      ) : !access.canDevelop ? (
        <p className="mt-2 text-muted">Terminez votre inscription pour développer les articles.</p>
      ) : (
        <div className="mt-2">
          {(error || state.status === "failed") && <p className="text-muted">{error ?? (state.status === "failed" ? state.message : "")}</p>}
          <button type="button" onClick={() => void s.develop()} className="btn-secondary mt-2">
            {error || state.status === "failed" ? "Réessayer" : "Générer la synthèse"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Bouton commun au fil et à la page de lecture : même libellé partout, comportement prévisible.
 * `subtle` (fil) : contour discret, pour que les titres dominent la page ; plein orange sur la
 * page de lecture seulement (audit UX du 17 novembre, P1-1).
 */
function SynthesisButton({ open, onClick, subtle = false }: { open: boolean; onClick: () => void; subtle?: boolean }) {
  const style = subtle
    ? open ? "h-9 bg-accent-soft px-3 text-accent ring-1 ring-accent" : "h-9 px-3 text-accent ring-1 ring-accent-line hover:bg-accent-soft"
    : open ? "h-10 bg-white px-4 text-accent ring-1 ring-accent" : "h-10 bg-accent px-4 text-white hover:bg-accent-dark";
  return (
    <button type="button" onClick={onClick} aria-expanded={open}
      className={`inline-flex items-center gap-2 rounded-lg text-sm font-semibold transition ${style}`}>
      <Icon id="synthese" size={17} strokeWidth={1.9} />
      {open ? "Masquer la synthèse IA" : "Synthèse IA de l’article"}
    </button>
  );
}

const ACTION = "inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-soft transition hover:bg-chip hover:text-ink sm:px-2.5";

/** Actions d’une carte : bouton « Synthèse IA » puis lien source, synthèse dépliée dessous ; puis réactions, commentaires, salon, partage. */
export function CardActions({
  postId,
  commentCount,
  roomCount,
  roomHref,
  canDevelopSource,
  initial,
  access,
  reactions,
  relay,
  share,
  sourceLink,
  postTitle,
  naturalVoice,
}: {
  /** Voix naturelle disponible (clé du service configurée) : la synthèse est lue par le serveur. */
  naturalVoice?: boolean;
  postId: string;
  postTitle?: string;
  commentCount: number;
  roomCount: number;
  roomHref: string;
  canDevelopSource: boolean;
  initial: SynthesisState;
  access: Access;
  reactions?: React.ReactNode;
  /** Bouton « Relayer à mes abonnés ». */
  relay?: React.ReactNode;
  share?: React.ReactNode;
  /** Lien vers l'article d'origine, affiché après le bouton de synthèse. */
  sourceLink?: React.ReactNode;
}) {
  const s = useSynthesis(postId, initial);
  const [open, setOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [count, setCount] = useState(commentCount);
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && access.canDevelop && needsRun(s.state)) void s.develop();
  }
  return (
    <>
      {(canDevelopSource || sourceLink) && (
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {canDevelopSource && <SynthesisButton subtle open={open} onClick={toggle} />}
          {sourceLink}
        </div>
      )}
      {open && (
        <div className="mt-3">
          <SynthesisView postId={postId} s={s} access={access} roomHref={roomHref} naturalVoice={naturalVoice} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-0.5 border-t border-hairline pt-2">
        {reactions}
        <button type="button" onClick={() => setCommentsOpen(!commentsOpen)} aria-expanded={commentsOpen}
          className={`${ACTION} ${commentsOpen ? "bg-chip text-ink" : ""}`} aria-label={`Commentaires${count ? ` (${count})` : ""}`}>
          <Icon id="commenter" />
          {count > 0 ? <>{count}<span className="sr-only sm:not-sr-only"> commentaire{count > 1 ? "s" : ""}</span></> : "Commenter"}
        </button>
        <RoomsPopover postId={postId} postTitle={postTitle ?? ""} roomCount={roomCount} signedIn={access.signedIn} canCreate={access.canDevelop} />
        {relay}
        {share}
      </div>
      {commentsOpen && <InlineComments postId={postId} access={{ signedIn: access.signedIn, canComment: access.canDevelop }} onCount={setCount} />}
    </>
  );
}

/** Bloc de synthèse de la page de lecture : même bouton que dans le fil, lien source après. */
export function DevelopSection({ postId, initial, access, roomHref, sourceLink, naturalVoice }: { postId: string; initial: SynthesisState; access: Access; roomHref: string; sourceLink?: React.ReactNode; naturalVoice?: boolean }) {
  const s = useSynthesis(postId, initial);
  const [open, setOpen] = useState(initial.status === "ready");
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && access.canDevelop && needsRun(s.state)) void s.develop();
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SynthesisButton open={open} onClick={toggle} />
        {sourceLink}
      </div>
      {open && <SynthesisView postId={postId} s={s} access={access} roomHref={roomHref} naturalVoice={naturalVoice} />}
    </div>
  );
}
