"use client";

// Les jeux liés aux thèmes : le défi du jour (le même pour tous, une fois par jour),
// « Quiz du thème », « Vrai ou faux express », « Plus ou moins » et « La frise ».
// Tout se joue sans compte : le résultat du défi du jour est alors gardé dans le navigateur.
// Un membre connecté envoie en fin de partie ses réponses et la graine de la manche à
// /api/jeux : le serveur rejoue, note et attribue les points du classement.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RankedItem } from "@/lib/jeux/classements.ts";
import {
  friseGame, friseScore, previousDay, questionRound,
  DAILY_SIZE, DUEL_ROUND, FRISE_EVENTS, FRISE_ROUND, VF_ROUND, type Frise, type Game, type PlayableQuestion,
} from "@/lib/jeux/tirage.ts";

interface ThemeOption {
  slug: string;
  name: string;
}

type Mode = { kind: "quiz"; theme: string } | { kind: "vf" } | { kind: "duel" } | { kind: "defi" } | { kind: "frise" } | null;

interface DailyResult {
  day: string;
  marks: boolean[];
  streak: number;
}

const DAILY_KEY = "valyo:defi";

const newSeed = () => Math.random().toString(36).slice(2, 12);

/** Ce que le serveur a fait de la partie : points gagnés, ou partie déjà comptée aujourd'hui. */
type Outcome = { state: "sending" } | { state: "done"; counted: boolean; points: number } | { state: "error" } | null;

async function sendScore(body: { game: Game; seed: string; theme?: string; day?: string; picks: number[] | number[][] }): Promise<Outcome> {
  try {
    const response = await fetch("/api/jeux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) return { state: "error" };
    const data = await response.json();
    return { state: "done", counted: Boolean(data.counted), points: Number(data.points) || 0 };
  } catch {
    return { state: "error" };
  }
}

function PointsNote({ outcome, isMember }: { outcome: Outcome; isMember: boolean }) {
  if (!isMember) {
    return <p className="mt-3 text-sm text-soft"><Link href="/connexion?next=/jeux" className="btn-link">Connectez-vous</Link> pour marquer des points et entrer au classement.</p>;
  }
  if (!outcome || outcome.state === "sending") return <p className="mt-3 text-sm text-muted">Calcul des points…</p>;
  if (outcome.state === "error") return <p className="mt-3 text-sm text-muted">Les points n’ont pas pu être enregistrés cette fois.</p>;
  return outcome.counted
    ? <p className="mt-3 text-sm font-semibold text-accent">+{outcome.points} points au classement</p>
    : <p className="mt-3 text-sm text-muted">Partie déjà comptée aujourd’hui pour ce jeu : revenez demain pour marquer à nouveau.</p>;
}

function readDaily(): DailyResult | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DAILY_KEY) ?? "null");
    if (parsed && typeof parsed.day === "string" && Array.isArray(parsed.marks) && Number.isInteger(parsed.streak)) {
      return { day: parsed.day, marks: parsed.marks.map(Boolean), streak: parsed.streak };
    }
  } catch { /* Stockage indisponible (navigation privée…) : le défi reste jouable, sans mémoire. */ }
  return null;
}

function writeDaily(result: DailyResult) {
  try { window.localStorage.setItem(DAILY_KEY, JSON.stringify(result)); } catch { /* idem */ }
}

function scoreMessage(score: number, total: number): string {
  const ratio = score / total;
  if (ratio === 1) return "Sans faute ! Vous avez votre place dans les salons.";
  if (ratio >= 0.75) return "Très solide. Encore une partie et c'est le sans-faute ?";
  if (ratio >= 0.5) return "Pas mal du tout — les explications sous chaque question aident à progresser.";
  return "L'occasion d'apprendre ! Suivez les thèmes sur Valyo pour creuser le sujet.";
}

function buildRound(mode: Mode, day: string, seed: string): PlayableQuestion[] {
  if (!mode || mode.kind === "frise") return [];
  return questionRound(mode.kind, { seed, theme: mode.kind === "quiz" ? mode.theme : undefined, day });
}

export function GamesClient({ themes, initialTheme, day, dayLabel, isMember, serverDaily }: {
  themes: ThemeOption[];
  initialTheme: string | null;
  /** Date du jour à Paris (AAAA-MM-JJ), calculée par le serveur : la graine du défi. */
  day: string;
  dayLabel: string;
  /** Membre connecté et actif : ses parties rapportent des points. */
  isMember: boolean;
  /** Défi du jour déjà joué par ce membre, d'après le serveur (vaut sur tous ses appareils). */
  serverDaily: DailyResult | null;
}) {
  const router = useRouter();
  const themeNames = useMemo(() => new Map(themes.map((t) => [t.slug, t.name])), [themes]);
  const initialMode: Mode = initialTheme ? { kind: "quiz", theme: initialTheme } : null;
  const [mode, setMode] = useState<Mode>(initialMode);
  // Première manche sans aléa (graine vide) : même HTML côté serveur et navigateur. Les relances mélangent.
  const [seed, setSeed] = useState("");
  const [round, setRound] = useState<PlayableQuestion[]>(() => buildRound(initialMode, day, ""));
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [saved, setSaved] = useState<DailyResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);

  useEffect(() => { setSaved(readDaily()); }, []);
  const today = serverDaily ?? (saved?.day === day ? saved : null);
  const marks = picks.map((p, i) => p === round[i]?.answer);

  const start = (next: Mode) => {
    const fresh = newSeed();
    setMode(next);
    setSeed(fresh);
    setRound(buildRound(next, day, fresh));
    setStep(0);
    setPicked(null);
    setPicks([]);
    setOutcome(null);
  };

  const report = async (body: Parameters<typeof sendScore>[0]) => {
    if (!isMember) return;
    setOutcome({ state: "sending" });
    setOutcome(await sendScore(body));
    router.refresh(); // Le classement, rendu par le serveur, se met à jour.
  };

  if (mode?.kind === "frise") return <FriseGame key={seed} seed={seed} themeNames={themeNames} isMember={isMember} outcome={outcome} onFinish={(all) => report({ game: "frise", seed, picks: all })} onReplay={() => start({ kind: "frise" })} onExit={() => start(null)} />;

  // Écran d'accueil : le défi du jour, puis les jeux libres.
  if (!mode || round.length === 0) {
    return (
      <div className="space-y-5">
        <section className="card border-l-4 border-accent p-5 sm:p-6">
          <p className="label-mono text-accent">Défi du jour · {dayLabel}</p>
          <h2 className="mt-1 text-lg font-extrabold">{DAILY_SIZE} questions, les mêmes pour tout le monde</h2>
          {today ? (
            <DailySummary result={today} dayLabel={dayLabel} />
          ) : (
            <>
              <p className="mt-1 text-sm text-soft">Une seule tentative par jour. Comparez votre score avec vos proches, et revenez demain pour le suivant.</p>
              <button type="button" onClick={() => start({ kind: "defi" })} className="btn-primary mt-3">Relever le défi</button>
            </>
          )}
        </section>
        <section className="card p-5 sm:p-6">
          <p className="label-mono text-accent">Quiz du thème</p>
          <h2 className="mt-1 text-lg font-extrabold">Cinq questions sur un thème</h2>
          <p className="mt-1 text-sm text-soft">Choisissez un thème : une explication accompagne chaque réponse.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {themes.map((t) => (
              <li key={t.slug}>
                <button type="button" onClick={() => start({ kind: "quiz", theme: t.slug })} className="chip min-h-9 px-3 text-sm hover:ring-1 hover:ring-accent">
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <div className="grid gap-5 sm:grid-cols-3">
          <GameCard label="Vrai ou faux express" title="Idées reçues" text={`${VF_ROUND} affirmations piochées dans tous les thèmes.`} onStart={() => start({ kind: "vf" })} />
          <GameCard label="Plus ou moins" title="Ordres de grandeur" text={`${DUEL_ROUND} duels : lequel est le plus grand, le plus rapide, le plus chaud ?`} onStart={() => start({ kind: "duel" })} />
          <GameCard label="La frise" title="Dans l'ordre" text={`${FRISE_ROUND} séries de ${FRISE_EVENTS} événements à remettre du plus ancien au plus récent.`} onStart={() => start({ kind: "frise" })} />
        </div>
      </div>
    );
  }

  const title = mode.kind === "vf" ? "Vrai ou faux express"
    : mode.kind === "duel" ? "Plus ou moins"
    : mode.kind === "defi" ? `Défi du jour · ${dayLabel}`
    : `Quiz ${themeNames.get(mode.theme) ?? mode.theme}`;
  const score = marks.filter(Boolean).length;

  // Écran de fin : score et relance (le défi du jour, lui, ne se rejoue pas).
  if (step >= round.length) {
    return (
      <section className="card p-6 text-center" aria-live="polite">
        <p className="label-mono text-accent">{title}</p>
        {mode.kind === "defi" && today ? (
          <DailySummary result={today} dayLabel={dayLabel} centered />
        ) : (
          <>
            <p className="mt-3 text-4xl font-extrabold">{score} / {round.length}</p>
            <p className="mt-2 text-soft">{scoreMessage(score, round.length)}</p>
          </>
        )}
        <PointsNote outcome={outcome} isMember={isMember} />
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {mode.kind !== "defi" && <button type="button" onClick={() => start(mode)} className="btn-primary">Rejouer</button>}
          <button type="button" onClick={() => start(null)} className="btn-secondary">{mode.kind === "defi" ? "Voir les autres jeux" : "Changer de jeu"}</button>
          {mode.kind === "quiz" && <Link href={`/theme/${mode.theme}`} className="btn-secondary">Voir le thème</Link>}
        </div>
      </section>
    );
  }

  const q = round[step];
  const answered = picked !== null;
  const next = () => {
    if (step + 1 === round.length) {
      if (mode.kind === "defi") {
        const result = { day, marks, streak: saved?.day === previousDay(day) ? saved.streak + 1 : 1 };
        writeDaily(result);
        setSaved(result);
      }
      void report({ game: mode.kind, seed, theme: mode.kind === "quiz" ? mode.theme : undefined, day: mode.kind === "defi" ? day : undefined, picks });
    }
    setStep((s) => s + 1);
    setPicked(null);
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-mono text-accent">{title}</p>
        <p className="shrink-0 text-sm text-muted">{step + 1} / {round.length}</p>
      </div>
      {mode.kind !== "quiz" && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{themeNames.get(q.theme) ?? q.theme}</p>}
      <p className="mt-2 text-lg font-bold">{q.prompt}</p>
      <ul className="mt-4 space-y-2">
        {q.choices.map((choice, i) => {
          const state = !answered ? "idle" : i === q.answer ? "right" : i === picked ? "wrong" : "muted";
          const cls =
            state === "right" ? "ring-2 ring-accent bg-accent-soft font-semibold"
            : state === "wrong" ? "ring-1 ring-line bg-chip line-through decoration-2 text-muted"
            : state === "muted" ? "ring-1 ring-line text-muted"
            : "ring-1 ring-line hover:ring-accent";
          return (
            <li key={choice}>
              <button
                type="button"
                disabled={answered}
                onClick={() => { setPicked(i); setPicks((p) => [...p, i]); }}
                className={`w-full rounded-lg px-4 py-3 text-left text-[15px] transition ${cls}`}
              >
                {choice}
              </button>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite" className="min-h-6">
        {answered && (
          <p className="mt-4 text-sm text-soft">
            <span className={`font-bold ${picked === q.answer ? "text-accent" : ""}`}>{picked === q.answer ? "Bonne réponse !" : "Raté."}</span>{" "}
            {q.explain}
          </p>
        )}
      </div>
      {answered && (
        <button type="button" onClick={next} className="btn-primary mt-4">
          {step + 1 < round.length ? "Question suivante" : "Voir mon score"}
        </button>
      )}
    </section>
  );
}

function GameCard({ label, title, text, onStart }: { label: string; title: string; text: string; onStart: () => void }) {
  return (
    <section className="card flex flex-col p-5">
      <p className="label-mono text-accent">{label}</p>
      <h2 className="mt-1 text-lg font-extrabold">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-soft">{text}</p>
      <button type="button" onClick={onStart} className="btn-secondary mt-3 self-start">Jouer</button>
    </section>
  );
}

/** Résultat du défi du jour : score, grille des réponses, série de jours et partage. */
function DailySummary({ result, dayLabel, centered = false }: { result: DailyResult; dayLabel: string; centered?: boolean }) {
  const [copied, setCopied] = useState(false);
  const score = result.marks.filter(Boolean).length;
  const total = result.marks.length;

  async function share() {
    const text = `Défi Valyo du ${dayLabel} : ${score}/${total}\n${result.marks.map((ok) => (ok ? "🟩" : "🟥")).join("")}\n${window.location.origin}/jeux`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* Partage annulé ou presse-papiers refusé : rien à faire. */ }
  }

  return (
    <div className={centered ? "flex flex-col items-center" : ""}>
      <p className="mt-3 text-4xl font-extrabold">{score} / {total}</p>
      <ol aria-label="Détail des réponses" className="mt-3 flex gap-1.5">
        {result.marks.map((ok, i) => (
          <li key={i} aria-label={`Question ${i + 1} : ${ok ? "juste" : "ratée"}`} className={`h-5 w-5 rounded ${ok ? "bg-accent" : "bg-chip ring-1 ring-line"}`} />
        ))}
      </ol>
      <p className="mt-3 text-sm text-soft">
        {result.streak > 1 ? `${result.streak} jours de suite. ` : ""}Prochain défi demain.
      </p>
      <button type="button" onClick={share} className="btn-primary mt-3">{copied ? "Score copié" : "Partager mon score"}</button>
    </div>
  );
}

/** La frise : toucher les événements du plus ancien au plus récent, puis valider. */
function FriseGame({ seed, themeNames, isMember, outcome, onFinish, onReplay, onExit }: {
  /** Graine de la partie : le parent remonte le composant (key) à chaque nouvelle graine. */
  seed: string;
  themeNames: Map<string, string>;
  isMember: boolean;
  outcome: Outcome;
  /** Fin de partie : pour chaque frise, les index d'événements dans l'ordre proposé. */
  onFinish: (picks: number[][]) => void;
  onReplay: () => void;
  onExit: () => void;
}) {
  const [frises] = useState<Frise[]>(() => friseGame(seed));
  const [step, setStep] = useState(0);
  const [order, setOrder] = useState<RankedItem[]>([]);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [allPicks, setAllPicks] = useState<number[][]>([]);
  const total = frises.length * FRISE_EVENTS;

  if (step >= frises.length) {
    return (
      <section className="card p-6 text-center" aria-live="polite">
        <p className="label-mono text-accent">La frise</p>
        <p className="mt-3 text-4xl font-extrabold">{score} / {total}</p>
        <p className="mt-1 text-sm text-muted">événements à la bonne place</p>
        <p className="mt-2 text-soft">{scoreMessage(score, total)}</p>
        <PointsNote outcome={outcome} isMember={isMember} />
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onReplay} className="btn-primary">Rejouer</button>
          <button type="button" onClick={onExit} className="btn-secondary">Changer de jeu</button>
        </div>
      </section>
    );
  }

  const frise = frises[step];
  const complete = order.length === frise.events.length;
  const toggle = (event: RankedItem) => setOrder((o) => (o.includes(event) ? o.filter((e) => e !== event) : [...o, event]));
  const right = checked ? friseScore(frise, order) : 0;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-mono text-accent">La frise</p>
        <p className="shrink-0 text-sm text-muted">{step + 1} / {frises.length}</p>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{themeNames.get(frise.theme) ?? frise.theme}</p>
      <p className="mt-2 text-lg font-bold">{frise.title}</p>

      {!checked ? (
        <>
          <p className="mt-1 text-sm text-soft">Touchez les événements du plus ancien au plus récent. Touchez à nouveau pour retirer un numéro.</p>
          <ul className="mt-4 space-y-2">
            {frise.events.map((event) => {
              const rank = order.indexOf(event);
              return (
                <li key={event.label}>
                  <button type="button" onClick={() => toggle(event)} aria-pressed={rank >= 0}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[15px] transition ${rank >= 0 ? "bg-accent-soft ring-2 ring-accent" : "ring-1 ring-line hover:ring-accent"}`}>
                    <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rank >= 0 ? "bg-accent text-white" : "bg-chip text-muted"}`}>{rank >= 0 ? rank + 1 : ""}</span>
                    <span>{event.label}{rank >= 0 && <span className="sr-only"> — position {rank + 1}</span>}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!complete} onClick={() => { setChecked(true); setScore((s) => s + friseScore(frise, order)); setAllPicks((p) => [...p, order.map((e) => frise.events.indexOf(e))]); }} className="btn-primary">Valider l’ordre</button>
            {order.length > 0 && <button type="button" onClick={() => setOrder([])} className="btn-secondary">Recommencer</button>}
          </div>
        </>
      ) : (
        <div aria-live="polite">
          <p className="mt-3 text-sm text-soft">
            <span className={`font-bold ${right === frise.events.length ? "text-accent" : ""}`}>
              {right === frise.events.length ? "Ordre parfait !" : `${right} sur ${frise.events.length} à la bonne place.`}
            </span>{" "}
            Voici la chronologie :
          </p>
          <ol className="mt-3 space-y-2">
            {frise.solution.map((event, i) => {
              const ok = order[i] === event;
              return (
                <li key={event.label} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] ${ok ? "bg-accent-soft ring-2 ring-accent" : "ring-1 ring-line"}`}>
                  <span className="w-12 shrink-0 font-mono text-sm font-bold">{event.display}</span>
                  <span className="flex-1">{event.label}</span>
                  <span className="shrink-0 text-xs text-muted">{ok ? "bien placé" : `vous : ${order.indexOf(event) + 1}ᵉ`}</span>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={() => { if (step + 1 === frises.length) onFinish(allPicks); setStep((s) => s + 1); setOrder([]); setChecked(false); }} className="btn-primary mt-4">
            {step + 1 < frises.length ? "Frise suivante" : "Voir mon score"}
          </button>
        </div>
      )}
    </section>
  );
}
