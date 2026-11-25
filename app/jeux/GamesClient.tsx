"use client";

// La page Jeux, en deux familles :
//  - Culture générale : le défi du jour (le même pour tous, une fois par jour), le quiz de la semaine
//    et le quiz libre (un thème ou tous) ;
//  - Coup d'œil : les jeux visuels (app/jeux/VisualGames.tsx).
// Tout se joue sans compte : le résultat du défi du jour est alors gardé dans le navigateur.
// Un membre connecté envoie en fin de partie ses réponses et la graine de la manche à
// /api/jeux : le serveur rejoue, note et attribue les points du classement.

import Link from "next/link";
import { Picto, type PictoId } from "@/components/Picto";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { COURBE_ROUND } from "@/lib/jeux/courbes.ts";
import { ECHELLE_BOARDS, ECHELLE_ITEMS } from "@/lib/jeux/echelle.ts";
import { weeklyRound, type WeeklyQuestion } from "@/lib/jeux/hebdo.ts";
import { previousDay, questionRound, ALL_THEMES, DAILY_SIZE, FRISE_EVENTS, FRISE_ROUND, type PlayableQuestion } from "@/lib/jeux/tirage.ts";
import { PointsNote, scoreMessage, sendScore, type Outcome } from "./shared";
import { CourbeGame, EchelleGame, FriseGame } from "./VisualGames";

interface ThemeOption {
  slug: string;
  name: string;
}

type Visual = "echelle" | "courbe" | "frise";
type Mode = { kind: "quiz"; theme: string } | { kind: "defi" } | { kind: "hebdo" } | { kind: Visual } | null;
const isVisual = (mode: Mode): mode is { kind: Visual } => mode?.kind === "echelle" || mode?.kind === "courbe" || mode?.kind === "frise";

/** Le quiz de la semaine en cours : son lundi, ses questions et, pour un membre, son score déjà compté. */
export interface WeeklyQuiz {
  week: string;
  questions: WeeklyQuestion[];
  played: { correct: number; total: number } | null;
}

interface DailyResult {
  day: string;
  marks: boolean[];
  streak: number;
  /** Réponses données (gardées dans le navigateur) : un visiteur qui se connecte ensuite voit son défi compté. */
  picks?: number[];
}

const DAILY_KEY = "valyo:defi";

const newSeed = () => Math.random().toString(36).slice(2, 12);

function readDaily(): DailyResult | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DAILY_KEY) ?? "null");
    if (parsed && typeof parsed.day === "string" && Array.isArray(parsed.marks) && Number.isInteger(parsed.streak)) {
      const picks = Array.isArray(parsed.picks) && parsed.picks.every(Number.isInteger) ? (parsed.picks as number[]) : undefined;
      return { day: parsed.day, marks: parsed.marks.map(Boolean), streak: parsed.streak, picks };
    }
  } catch { /* Stockage indisponible (navigation privée…) : le défi reste jouable, sans mémoire. */ }
  return null;
}

function writeDaily(result: DailyResult) {
  try { window.localStorage.setItem(DAILY_KEY, JSON.stringify(result)); } catch { /* idem */ }
}

function buildRound(mode: Mode, day: string, seed: string, weekly: WeeklyQuiz | null): PlayableQuestion[] {
  if (!mode || isVisual(mode)) return [];
  if (mode.kind === "hebdo") return weekly ? weeklyRound(weekly.questions, seed) : [];
  return questionRound(mode.kind, { seed, theme: mode.kind === "quiz" ? mode.theme : undefined, day });
}

export function GamesClient({ themes, initialTheme, initialSeed, day, dayLabel, isMember, serverDaily, weekly }: {
  themes: ThemeOption[];
  initialTheme: string | null;
  /** Graine tirée par le serveur pour la manche ouverte par /jeux?theme=… : même tirage des deux côtés. */
  initialSeed: string;
  /** Date du jour à Paris (AAAA-MM-JJ), calculée par le serveur : la graine du défi. */
  day: string;
  dayLabel: string;
  /** Membre connecté et actif : ses parties rapportent des points. */
  isMember: boolean;
  /** Défi du jour déjà joué par ce membre, d'après le serveur (vaut sur tous ses appareils). */
  serverDaily: DailyResult | null;
  /** Quiz de la semaine, s'il y en a un de prêt. */
  weekly: WeeklyQuiz | null;
}) {
  const router = useRouter();
  const themeNames = useMemo(() => new Map(themes.map((t) => [t.slug, t.name])), [themes]);
  const initialMode: Mode = initialTheme ? { kind: "quiz", theme: initialTheme } : null;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [seed, setSeed] = useState(initialSeed);
  const [round, setRound] = useState<PlayableQuestion[]>(() => buildRound(initialMode, day, initialSeed, weekly));
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [saved, setSaved] = useState<DailyResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);

  useEffect(() => {
    const stored = readDaily();
    setSaved(stored);
    // Défi joué sans être connecté, puis connexion : on l'envoie tel quel, il compte une seule fois.
    if (isMember && !serverDaily && stored?.day === day && stored.picks) {
      void sendScore({ game: "defi", seed: "", day, picks: stored.picks }).then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const today = serverDaily ?? (saved?.day === day ? saved : null);
  const marks = picks.map((p, i) => p === round[i]?.answer);

  const start = (next: Mode) => {
    const fresh = newSeed();
    setMode(next);
    setSeed(fresh);
    setRound(buildRound(next, day, fresh, weekly));
    setStep(0);
    setPicked(null);
    setPicks([]);
    setOutcome(null);
    // La carte choisie pouvait être bas dans la page : le jeu s'ouvre en haut de l'écran.
    window.scrollTo({ top: 0 });
  };

  const report = async (body: Parameters<typeof sendScore>[0]) => {
    if (!isMember) return;
    setOutcome({ state: "sending" });
    setOutcome(await sendScore(body));
    router.refresh(); // Le classement, rendu par le serveur, se met à jour.
  };

  if (isVisual(mode)) {
    const kind = mode.kind;
    const Game = kind === "echelle" ? EchelleGame : kind === "courbe" ? CourbeGame : FriseGame;
    return <Game key={seed} seed={seed} themeNames={themeNames} isMember={isMember} outcome={outcome} onFinish={(all) => report({ game: kind, seed, picks: all })} onReplay={() => start({ kind })} onExit={() => start(null)} />;
  }

  // Écran d'accueil : le défi du jour, puis les jeux libres.
  if (!mode || round.length === 0) {
    return (
      <div className="space-y-5">
        <section className="card border-l-4 border-accent p-5 sm:p-6">
          <CardHead picto="defi" label={`Défi du jour · ${dayLabel}`} title={`${DAILY_SIZE} questions, les mêmes pour tout le monde`} />
          {today ? (
            <DailySummary result={today} dayLabel={dayLabel} />
          ) : (
            <>
              <p className="mt-1 text-sm text-soft">Une seule tentative par jour. Comparez votre score avec vos proches, et revenez demain pour le suivant.</p>
              <button type="button" onClick={() => start({ kind: "defi" })} className="btn-primary mt-3">Relever le défi</button>
            </>
          )}
        </section>
        <FamilyHead title="Culture générale" text="Des questions, et une explication à chaque réponse." />
        {weekly && (
          <section className="card p-5 sm:p-6">
            <CardHead picto="hebdo" label="Quiz de la semaine" title={`${weekly.questions.length} questions sur l’actualité du fil`} />
            <p className="mt-2 text-sm text-soft">
              Tirées des articles publiés sur Valyo ces sept derniers jours ; chaque réponse renvoie à son article. Questions écrites et relues par l’IA.
            </p>
            {weekly.played && <p className="mt-2 text-sm font-semibold">Votre score cette semaine : {weekly.played.correct} / {weekly.played.total}</p>}
            <button type="button" onClick={() => start({ kind: "hebdo" })} className={`mt-3 ${weekly.played ? "btn-secondary" : "btn-primary"}`}>
              {weekly.played ? "Rejouer pour le plaisir" : "Jouer"}
            </button>
          </section>
        )}
        <section className="card p-5 sm:p-6">
          <CardHead picto="quiz" label="Quiz libre" title="Cinq questions, sur le thème de votre choix" />
          <p className="mt-2 text-sm text-soft">Questions à choix et vrai ou faux, tirés au hasard : différents à chaque partie.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li>
              <button type="button" onClick={() => start({ kind: "quiz", theme: ALL_THEMES })} className="inline-flex min-h-10 items-center rounded-lg bg-ink px-3 text-sm font-semibold text-white transition hover:opacity-90">
                Tous les thèmes
              </button>
            </li>
            {themes.map((t) => (
              <li key={t.slug}>
                <button type="button" onClick={() => start({ kind: "quiz", theme: t.slug })} className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-sm font-medium text-ink ring-1 ring-line transition hover:ring-ink">
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <FamilyHead title="Coup d’œil" text="On place, on trace, on glisse : moins de lecture, plus d’intuition." />
        <div className="grid gap-5 sm:grid-cols-3">
          <GameCard picto="echelle" label="À l’échelle" title="Sur la règle" text={`${ECHELLE_BOARDS} règles, ${ECHELLE_ITEMS} objets à placer sur chacune, entre le plus petit et le plus grand.`} onStart={() => start({ kind: "echelle" })} />
          <GameCard picto="courbe" label="Dessine la courbe" title="À main levée" text={`${COURBE_ROUND} évolutions à tracer au doigt, puis la vraie courbe apparaît par-dessus.`} onStart={() => start({ kind: "courbe" })} />
          <GameCard picto="frise" label="La frise" title="Dans l’ordre" text={`${FRISE_ROUND} séries de ${FRISE_EVENTS} événements à glisser du plus ancien au plus récent.`} onStart={() => start({ kind: "frise" })} />
        </div>
      </div>
    );
  }

  const anyTheme = mode.kind === "quiz" && mode.theme === ALL_THEMES;
  const title = mode.kind === "defi" ? `Défi du jour · ${dayLabel}`
    : mode.kind === "hebdo" ? "Quiz de la semaine"
    : anyTheme ? "Quiz · tous les thèmes"
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
            <p className="mt-3 text-4xl font-bold">{score} / {round.length}</p>
            <p className="mt-2 text-soft">{scoreMessage(score, round.length)}</p>
          </>
        )}
        <PointsNote outcome={outcome} isMember={isMember} />
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {mode.kind !== "defi" && <button type="button" onClick={() => start(mode)} className="btn-primary">Rejouer</button>}
          <button type="button" onClick={() => start(null)} className="btn-secondary">{mode.kind === "defi" ? "Voir les autres jeux" : "Changer de jeu"}</button>
          {mode.kind === "quiz" && !anyTheme && <Link href={`/theme/${mode.theme}`} className="btn-secondary">Voir le thème</Link>}
        </div>
      </section>
    );
  }

  const q = round[step];
  const answered = picked !== null;
  const next = () => {
    if (step + 1 === round.length) {
      if (mode.kind === "defi") {
        const result = { day, marks, streak: saved?.day === previousDay(day) ? saved.streak + 1 : 1, picks };
        writeDaily(result);
        setSaved(result);
      }
      void report({ game: mode.kind, seed, theme: mode.kind === "quiz" ? mode.theme : undefined, day: mode.kind === "defi" ? day : mode.kind === "hebdo" ? weekly?.week : undefined, picks });
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
      {(mode.kind !== "quiz" || anyTheme) && q.theme && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{themeNames.get(q.theme) ?? q.theme}</p>}
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
            {q.link && <>{" "}<Link href={q.link.href} target="_blank" className="btn-link whitespace-nowrap">{q.link.label} →</Link></>}
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

/** En-tête d'une carte de jeu : le pictogramme, puis l'étiquette et le titre. */
function CardHead({ picto, label, title }: { picto: PictoId; label: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <Picto id={picto} />
      <div className="min-w-0">
        <p className="label-mono">{label}</p>
        <h3 className="mt-0.5 text-lg font-bold leading-snug">{title}</h3>
      </div>
    </div>
  );
}

/** Titre d'une famille de jeux. */
function FamilyHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="pt-3">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-0.5 text-sm text-soft">{text}</p>
    </div>
  );
}

function GameCard({ picto, label, title, text, onStart }: { picto: PictoId; label: string; title: string; text: string; onStart: () => void }) {
  return (
    <section className="card flex flex-col p-5">
      <CardHead picto={picto} label={label} title={title} />
      <p className="mt-2 flex-1 text-sm text-soft">{text}</p>
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
      <p className="mt-3 text-4xl font-bold">{score} / {total}</p>
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
