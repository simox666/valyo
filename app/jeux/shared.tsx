"use client";

// Ce que partagent tous les jeux : l'envoi de la partie au serveur et la note de points en fin de partie.

import Link from "next/link";
import type { Game } from "@/lib/jeux/tirage.ts";

/** Ce que le serveur a fait de la partie : points gagnés, ou partie déjà comptée aujourd'hui. */
export type Outcome = { state: "sending" } | { state: "done"; counted: boolean; points: number; streakBonus: number } | { state: "error" } | null;

export async function sendScore(body: { game: Game; seed: string; theme?: string; day?: string; picks: number[] | number[][] }): Promise<Outcome> {
  try {
    const response = await fetch("/api/jeux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) return { state: "error" };
    const data = await response.json();
    return { state: "done", counted: Boolean(data.counted), points: Number(data.points) || 0, streakBonus: Number(data.streakBonus) || 0 };
  } catch {
    return { state: "error" };
  }
}

export function PointsNote({ outcome, isMember }: { outcome: Outcome; isMember: boolean }) {
  if (!isMember) {
    return <p className="mt-3 text-sm text-soft"><Link href="/connexion?next=/jeux" className="btn-link">Connectez-vous</Link> pour marquer des points et entrer au classement.</p>;
  }
  if (!outcome || outcome.state === "sending") return <p className="mt-3 text-sm text-muted">Calcul des points…</p>;
  if (outcome.state === "error") return <p className="mt-3 text-sm text-muted">Les points n’ont pas pu être enregistrés cette fois.</p>;
  return outcome.counted
    ? <p className="mt-3 text-sm font-semibold text-accent">+{outcome.points} points au classement{outcome.streakBonus > 0 ? ` (dont ${outcome.streakBonus} de série)` : ""}</p>
    : <p className="mt-3 text-sm text-muted">Partie déjà comptée pour ce jeu : seule la première rapporte des points.</p>;
}

export function scoreMessage(score: number, total: number): string {
  const ratio = score / total;
  if (ratio === 1) return "Sans faute ! Vous avez votre place dans les salons.";
  if (ratio >= 0.75) return "Très solide. Encore une partie et c'est le sans-faute ?";
  if (ratio >= 0.5) return "Pas mal du tout — les explications aident à progresser.";
  return "L'occasion d'apprendre ! Suivez les thèmes sur Valyo pour creuser le sujet.";
}

/** Écran de fin commun aux jeux visuels. */
export function EndScreen({ title, score, total, unit, outcome, isMember, onReplay, onExit }: {
  title: string;
  score: number;
  total: number;
  /** Ce que compte le score : « objets bien placés », « points de courbe justes »… */
  unit: string;
  outcome: Outcome;
  isMember: boolean;
  onReplay: () => void;
  onExit: () => void;
}) {
  return (
    <section className="card p-6 text-center" aria-live="polite">
      <p className="label-mono text-accent">{title}</p>
      <p className="mt-3 text-4xl font-bold">{score} / {total}</p>
      <p className="mt-1 text-sm text-muted">{unit}</p>
      <p className="mt-2 text-soft">{scoreMessage(score, total)}</p>
      <PointsNote outcome={outcome} isMember={isMember} />
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onReplay} className="btn-primary">Rejouer</button>
        <button type="button" onClick={onExit} className="btn-secondary">Changer de jeu</button>
      </div>
    </section>
  );
}

/** Ce que reçoit chaque jeu visuel de la page. */
export interface VisualGameProps {
  /** Graine de la partie : le parent remonte le composant (key) à chaque nouvelle graine. */
  seed: string;
  themeNames: Map<string, string>;
  isMember: boolean;
  outcome: Outcome;
  /** Fin de partie : une ligne de réponses par manche. */
  onFinish: (picks: number[][]) => void;
  onReplay: () => void;
  onExit: () => void;
}
