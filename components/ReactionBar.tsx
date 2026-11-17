"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api, loginUrl } from "@/lib/client";
import { REACTIONS, type ReactionKind, type ReactionSummary } from "@/lib/social/reaction-kinds.ts";

/**
 * Réactions rapides. Mise à jour optimiste, annulée si le serveur refuse.
 * Visiteur : le clic mène à la connexion avec retour à la page. `compact` : version carte.
 */
export function ReactionBar({
  postId,
  initial,
  signedIn,
  canReact,
  compact = false,
  variant = "pills",
  kinds,
}: {
  postId: string;
  initial: ReactionSummary;
  signedIn: boolean;
  canReact: boolean;
  compact?: boolean;
  /** « vote » : ▲ et le compte d'« Intéressant » en colonne ; « inline » : boutons texte en chasse fixe. */
  variant?: "pills" | "vote" | "inline";
  kinds?: ReactionKind[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<ReactionKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(false);

  async function toggle(kind: ReactionKind) {
    if (!signedIn) {
      router.push(loginUrl(pathname));
      return;
    }
    if (!canReact || busy) return;
    const on = !state.mine.includes(kind);
    const previous = state;
    setState({
      counts: { ...state.counts, [kind]: Math.max(0, state.counts[kind] + (on ? 1 : -1)) },
      mine: on ? [...state.mine, kind] : state.mine.filter((k) => k !== kind),
    });
    setBusy(kind);
    setError(null);
    const result = await api<ReactionSummary>("POST", `/api/posts/${postId}/reactions`, { kind, on });
    setBusy(null);
    if (result.ok) {
      setState({ counts: result.data.counts, mine: result.data.mine });
      if (kind === "a_creuser" && on) {
        setNote(true);
        setTimeout(() => setNote(false), 3500);
      }
    }
    else {
      setState(previous);
      setError(result.data.error ?? "Réaction impossible.");
    }
  }

  const title = (label: string) => (signedIn ? label : `${label} — connectez-vous pour réagir`);
  const errorNode = error && <span role="alert" className="error-text">{error}</span>;

  if (variant === "vote") {
    const active = state.mine.includes("interessant");
    return (
      <div className="flex flex-col items-center gap-1 font-mono" role="group" aria-label="Réactions">
        <button
          type="button"
          aria-pressed={active}
          disabled={signedIn && !canReact}
          onClick={() => toggle("interessant")}
          title={title("Intéressant")}
          className={`flex h-11 w-11 items-center justify-center border transition ${active ? "border-accent bg-accent text-white" : "border-line bg-white text-accent hover:border-ink"} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 15 6-6 6 6" /></svg>
          <span className="sr-only">Intéressant{active ? " (votre réaction)" : ""}</span>
        </button>
        <span className="text-[15px] font-bold tabular-nums">{state.counts.interessant}</span>
        {errorNode}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-0.5" role="group" aria-label="Réactions">
        {REACTIONS.filter((r) => !kinds || kinds.includes(r.kind)).map((r) => {
          const active = state.mine.includes(r.kind);
          const count = state.counts[r.kind];
          return (
            <button
              key={r.kind}
              type="button"
              aria-pressed={active}
              disabled={signedIn && !canReact}
              onClick={() => toggle(r.kind)}
              title={title(r.kind === "a_creuser" ? "À creuser : garder pour plus tard" : r.label)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition ${active ? "bg-accent-soft text-accent" : "text-soft hover:bg-chip hover:text-ink"} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Icon id={r.kind} filled={active} />
              {count > 0 && <span className="tabular-nums">{count}</span>}
              <span className="sr-only">{r.label}{active ? " (votre réaction)" : ""}</span>
            </button>
          );
        })}
        {note && (
          <Link href="/a-creuser" role="status" className="ml-1 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white">Gardé dans « À creuser » →</Link>
        )}
        {errorNode}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Réactions">
      {REACTIONS.map((r) => {
        const active = state.mine.includes(r.kind);
        const count = state.counts[r.kind];
        return (
          <button
            key={r.kind}
            type="button"
            aria-pressed={active}
            disabled={signedIn && !canReact}
            onClick={() => toggle(r.kind)}
            title={title(r.label)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
              active ? "bg-accent-soft text-accent ring-accent/40" : "bg-white text-soft ring-line hover:ring-ink"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span aria-hidden>{r.emoji}</span>
            {!compact && <span>{r.label}</span>}
            {count > 0 && <span className="tabular-nums">{count}</span>}
            <span className="sr-only">{compact ? r.label : ""}{active ? " (votre réaction)" : ""}</span>
          </button>
        );
      })}
      {errorNode}
    </div>
  );
}
