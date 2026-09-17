"use client";

import { useState } from "react";
import Link from "next/link";
import { pickRounds, targetRange, type GameItem } from "@/lib/game/items";
import { scoreGuess, type ScoreResult } from "@/lib/game/scoring";
import { logEvent } from "@/lib/analytics";
import GameReveal from "@/components/GameReveal";

type Stage = "intro" | "round" | "reveal" | "final";
const ROUND_COUNT = 5;

// Reference items are priced in whatever currency the pipeline found them
// in (mixed EUR/USD across the set) — a guess must be compared against the
// same currency it targets, or the score is meaningless for that round
// (project.md E1). No conversion: just ask for the guess in the right unit.
function currencyLabel(currency: string): string {
  if (currency === "EUR") return "€";
  if (currency === "USD") return "$";
  return currency;
}

export default function GamePage() {
  const [stage, setStage] = useState<Stage>("intro");
  const [rounds, setRounds] = useState<GameItem[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [scores, setScores] = useState<number[]>([]);
  const [lastResult, setLastResult] = useState<ScoreResult | null>(null);

  function start() {
    const picked = pickRounds(ROUND_COUNT);
    setRounds(picked);
    setRoundIndex(0);
    setScores([]);
    setGuess("");
    logEvent("game_started", { rounds: picked.length });
    setStage("round");
  }

  function submitGuess() {
    const value = Number(guess.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return;
    const item = rounds[roundIndex];
    const { low, high } = targetRange(item);
    const result = scoreGuess(value, low, high);
    setLastResult(result);
    setScores((s) => [...s, result.points]);
    logEvent("game_round_answered", { points: result.points, within_range: result.withinRange });
    setStage("reveal");
  }

  function nextRound() {
    if (roundIndex + 1 >= rounds.length) {
      const total = scores.reduce((a, b) => a + b, 0);
      logEvent("game_finished", { total_score: total, rounds: rounds.length });
      setStage("final");
    } else {
      setRoundIndex((i) => i + 1);
      setGuess("");
      setStage("round");
    }
  }

  const currentItem = rounds[roundIndex];
  const totalScore = scores.reduce((a, b) => a + b, 0);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      {stage === "intro" && (
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-3xl font-semibold text-ink">Devine le prix</h1>
          <p className="text-neutral-600">
            {ROUND_COUNT} objets réels, n&apos;importe quel type d&apos;objet. Devinez leur valeur — on vous
            dit à quel point vous êtes proche de notre estimation.
          </p>
          <button onClick={start} className="w-full rounded-full bg-ink text-white py-4 font-medium">
            Jouer
          </button>
          <Link href="/" className="block text-sm text-neutral-500 underline">
            Retour à l&apos;accueil
          </Link>
        </div>
      )}

      {stage === "round" && currentItem && (
        <div className="w-full max-w-md text-center space-y-6">
          <p className="text-xs text-neutral-400">
            Manche {roundIndex + 1} / {rounds.length}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/game/${currentItem.file}`}
            alt="Objet à estimer"
            className="w-full h-64 object-cover rounded-2xl"
          />
          <p className="text-lg font-medium text-ink">
            {[currentItem.analysis.brand, currentItem.analysis.model].filter(Boolean).join(" ") ||
              currentItem.analysis.category}
          </p>
          <p className="text-sm text-neutral-600">
            Combien vaut cet objet {targetRange(currentItem).basis === "retail" ? "à l'état neuf" : "d'occasion"}{" "}
            aujourd&apos;hui, en {currencyLabel(currentItem.analysis.currency)} ?
          </p>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={`Votre estimation en ${currencyLabel(currentItem.analysis.currency)}`}
            className="w-full rounded-lg border border-neutral-300 p-3 text-center text-lg"
          />
          <button
            onClick={submitGuess}
            disabled={guess.trim().length === 0}
            className="w-full rounded-full bg-ink text-white py-3 font-medium disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      )}

      {stage === "reveal" && currentItem && lastResult && (
        <div className="w-full max-w-md text-center space-y-4">
          <p className="text-xs text-neutral-400">
            Manche {roundIndex + 1} / {rounds.length}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/game/${currentItem.file}`} alt="Objet" className="w-full h-56 object-cover rounded-2xl" />
          <p className="text-3xl font-semibold text-ink">{lastResult.points} pts</p>
          <p className="text-sm text-neutral-600">
            {lastResult.withinRange ? "Dans le mille !" : "Pas tout à fait, mais on note l'effort."}
          </p>
          <GameReveal item={currentItem} />
          <button onClick={nextRound} className="w-full rounded-full bg-ink text-white py-3 font-medium">
            {roundIndex + 1 >= rounds.length ? "Voir le score final" : "Manche suivante"}
          </button>
        </div>
      )}

      {stage === "final" && (
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-2xl font-semibold text-ink">Score final</h1>
          <p className="text-4xl font-semibold text-ink">
            {totalScore} / {rounds.length * 100}
          </p>
          <button onClick={start} className="w-full rounded-full bg-ink text-white py-4 font-medium">
            Rejouer
          </button>
          <Link href="/" className="block text-sm text-neutral-500 underline">
            Retour à l&apos;accueil
          </Link>
        </div>
      )}
    </main>
  );
}
