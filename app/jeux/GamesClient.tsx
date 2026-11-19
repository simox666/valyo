"use client";

// Les deux jeux liés aux thèmes : « Quiz du thème » (les questions d'un thème choisi)
// et « Vrai ou faux express » (des affirmations tirées de tous les thèmes). Tout se
// joue côté client, sans compte ni enregistrement : on apprend, on rejoue, c'est tout.

import Link from "next/link";
import { useMemo, useState } from "react";
import { QUIZ_QUESTIONS, TRUE_FALSE_STATEMENTS } from "@/lib/jeux/questions";

interface ThemeOption {
  slug: string;
  name: string;
}

interface PlayableQuestion {
  prompt: string;
  choices: string[];
  answer: number;
  explain: string;
  themeName: string;
}

type Mode = { kind: "quiz"; theme: string } | { kind: "vf" } | null;

const VF_ROUND = 8;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRound(mode: Mode, themeNames: Map<string, string>): PlayableQuestion[] {
  if (!mode) return [];
  const nameOf = (slug: string) => themeNames.get(slug) ?? slug;
  if (mode.kind === "vf") {
    return shuffle(TRUE_FALSE_STATEMENTS).slice(0, VF_ROUND).map((s) => ({
      prompt: s.statement,
      choices: ["Vrai", "Faux"],
      answer: s.isTrue ? 0 : 1,
      explain: s.explain,
      themeName: nameOf(s.theme),
    }));
  }
  const mcq = QUIZ_QUESTIONS.filter((q) => q.theme === mode.theme).map((q) => {
    const order = shuffle(q.choices.map((_, i) => i));
    return {
      prompt: q.question,
      choices: order.map((i) => q.choices[i]),
      answer: order.indexOf(q.answer),
      explain: q.explain,
      themeName: nameOf(q.theme),
    };
  });
  const vf = TRUE_FALSE_STATEMENTS.filter((s) => s.theme === mode.theme).map((s) => ({
    prompt: s.statement,
    choices: ["Vrai", "Faux"],
    answer: s.isTrue ? 0 : 1,
    explain: s.explain,
    themeName: nameOf(s.theme),
  }));
  return shuffle([...mcq, ...vf]);
}

function scoreMessage(score: number, total: number): string {
  const ratio = score / total;
  if (ratio === 1) return "Sans faute ! Vous avez votre place dans les salons de ce thème.";
  if (ratio >= 0.75) return "Très solide. Encore une partie et c'est le sans-faute ?";
  if (ratio >= 0.5) return "Pas mal du tout — les explications sous chaque question aident à progresser.";
  return "L'occasion d'apprendre ! Suivez le thème sur Valyo pour creuser le sujet.";
}

export function GamesClient({ themes, initialTheme }: { themes: ThemeOption[]; initialTheme: string | null }) {
  const themeNames = useMemo(() => new Map(themes.map((t) => [t.slug, t.name])), [themes]);
  const [mode, setMode] = useState<Mode>(initialTheme ? { kind: "quiz", theme: initialTheme } : null);
  const [round, setRound] = useState<PlayableQuestion[]>(() => buildRound(initialTheme ? { kind: "quiz", theme: initialTheme } : null, themeNames));
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const start = (next: Mode) => {
    setMode(next);
    setRound(buildRound(next, themeNames));
    setStep(0);
    setPicked(null);
    setScore(0);
  };

  // Écran d'accueil : choisir un jeu.
  if (!mode || round.length === 0) {
    return (
      <div className="space-y-5">
        <section className="card p-5 sm:p-6">
          <p className="label-mono text-accent">Jeu 1</p>
          <h2 className="mt-1 text-lg font-extrabold">Quiz du thème</h2>
          <p className="mt-1 text-sm text-soft">Choisissez un thème : cinq questions, une explication à chaque réponse.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {themes.map((t) => (
              <li key={t.slug}>
                <button type="button" onClick={() => start({ kind: "quiz", theme: t.slug })} className="chip hover:ring-accent">
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5 sm:p-6">
          <p className="label-mono text-accent">Jeu 2</p>
          <h2 className="mt-1 text-lg font-extrabold">Vrai ou faux express</h2>
          <p className="mt-1 text-sm text-soft">{VF_ROUND} affirmations piochées dans tous les thèmes. Idées reçues bienvenues.</p>
          <button type="button" onClick={() => start({ kind: "vf" })} className="btn-primary mt-3">
            Lancer une partie
          </button>
        </section>
      </div>
    );
  }

  const title = mode.kind === "vf" ? "Vrai ou faux express" : `Quiz ${themeNames.get(mode.theme) ?? mode.theme}`;

  // Écran de fin : score et relance.
  if (step >= round.length) {
    return (
      <section className="card p-6 text-center" aria-live="polite">
        <p className="label-mono text-accent">{title}</p>
        <p className="mt-3 text-4xl font-extrabold">
          {score} / {round.length}
        </p>
        <p className="mt-2 text-soft">{scoreMessage(score, round.length)}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => start(mode)} className="btn-primary">Rejouer</button>
          <button type="button" onClick={() => start(null)} className="btn-secondary">Changer de jeu</button>
          {mode.kind === "quiz" && (
            <Link href={`/theme/${mode.theme}`} className="btn-secondary">Voir le thème</Link>
          )}
        </div>
      </section>
    );
  }

  const q = round[step];
  const answered = picked !== null;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-mono text-accent">{title}</p>
        <p className="shrink-0 text-sm text-muted">
          {step + 1} / {round.length}
        </p>
      </div>
      {mode.kind === "vf" && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{q.themeName}</p>}
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
                onClick={() => {
                  setPicked(i);
                  if (i === q.answer) setScore((s) => s + 1);
                }}
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
            <span className={`font-bold ${picked === q.answer ? "text-accent" : ""}`}>
              {picked === q.answer ? "Bonne réponse !" : "Raté."}
            </span>{" "}
            {q.explain}
          </p>
        )}
      </div>
      {answered && (
        <button type="button" onClick={() => { setStep((s) => s + 1); setPicked(null); }} className="btn-primary mt-4">
          {step + 1 < round.length ? "Question suivante" : "Voir mon score"}
        </button>
      )}
    </section>
  );
}
