"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { pickRounds, pickRoundsByIds, targetRange, type GameItem } from "@/lib/game/items";
import { scoreGuess, type ScoreResult } from "@/lib/game/scoring";
import { encodeChallenge, decodeChallenge } from "@/lib/game/challenge";
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

interface PendingChallenge {
  items: GameItem[];
  score: number;
}

function GameContent() {
  const t = useTranslations("game");
  const searchParams = useSearchParams();

  const [stage, setStage] = useState<Stage>("intro");
  const [rounds, setRounds] = useState<GameItem[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [scores, setScores] = useState<number[]>([]);
  const [lastResult, setLastResult] = useState<ScoreResult | null>(null);
  // The score to beat, only set once a game actually started from a
  // challenge link — null means "no one to compare against" (a normal
  // random game, or a replay after one).
  const [challengeScore, setChallengeScore] = useState<number | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  // Decoded once on mount from the URL (?c=...) — not reactive, since a
  // challenge link is only meaningful for the very next game the player
  // starts, not for every "Rejouer" afterward. A missing/invalid/stale link
  // (bad encoding, or an id no longer in the pool) silently falls back to a
  // normal random game rather than erroring (project.md, scan de pièce
  // established the same no-database, link-is-the-state approach).
  const [pendingChallenge] = useState<PendingChallenge | null>(() => {
    const raw = searchParams.get("c");
    if (!raw) return null;
    const decoded = decodeChallenge(raw);
    if (!decoded) return null;
    const picked = pickRoundsByIds(decoded.ids);
    if (!picked) return null;
    return { items: picked, score: decoded.score };
  });

  function start(useChallenge: boolean) {
    const challenge = useChallenge ? pendingChallenge : null;
    const picked = challenge ? challenge.items : pickRounds(ROUND_COUNT);
    setRounds(picked);
    setRoundIndex(0);
    setScores([]);
    setGuess("");
    setShareState("idle");
    setChallengeScore(challenge ? challenge.score : null);
    if (challenge) logEvent("challenge_started");
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

  async function shareChallenge() {
    const encoded = encodeChallenge({ ids: rounds.map((r) => r.id), score: totalScore });
    const url = `${window.location.origin}${window.location.pathname}?c=${encoded}`;
    logEvent("challenge_created");

    if (navigator.share) {
      try {
        await navigator.share({ title: t("shareDialogTitle"), text: t("shareDialogText", { score: totalScore }), url });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2500);
    } catch {
      // Clipboard access blocked — degrade silently, nothing else to fall back to here.
    }
  }

  const currentItem = rounds[roundIndex];
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const comparison: "won" | "lost" | "tied" | null =
    challengeScore === null
      ? null
      : totalScore > challengeScore
        ? "won"
        : totalScore < challengeScore
          ? "lost"
          : "tied";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      {stage === "intro" && (
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-3xl font-semibold text-ink">{t("title")}</h1>
          {pendingChallenge ? (
            <p className="text-neutral-600">{t("challengeIntro", { score: pendingChallenge.score })}</p>
          ) : (
            <p className="text-neutral-600">{t("intro", { count: ROUND_COUNT })}</p>
          )}
          <button
            onClick={() => start(Boolean(pendingChallenge))}
            className="w-full rounded-full bg-ink text-white py-4 font-medium"
          >
            {pendingChallenge ? t("acceptChallenge") : t("play")}
          </button>
          <Link href="/" className="block text-sm text-neutral-500 underline">
            {t("backHome")}
          </Link>
        </div>
      )}

      {stage === "round" && currentItem && (
        <div className="w-full max-w-md text-center space-y-6">
          <p className="text-xs text-neutral-400">
            {t("round", { current: roundIndex + 1, total: rounds.length })}
          </p>
          <div className="w-full h-64 bg-neutral-100 rounded-2xl flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/game/${currentItem.file}`}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <p className="text-lg font-medium text-ink">
            {[currentItem.analysis.brand, currentItem.analysis.model].filter(Boolean).join(" ") ||
              currentItem.analysis.category}
          </p>
          <p className="text-sm text-neutral-600">
            {t(targetRange(currentItem).basis === "retail" ? "guessPromptNew" : "guessPromptUsed", {
              currency: currencyLabel(currentItem.analysis.currency),
            })}
          </p>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={t("guessPlaceholder", { currency: currencyLabel(currentItem.analysis.currency) })}
            className="w-full rounded-lg border border-neutral-300 p-3 text-center text-lg"
          />
          <button
            onClick={submitGuess}
            disabled={guess.trim().length === 0}
            className="w-full rounded-full bg-ink text-white py-3 font-medium disabled:opacity-50"
          >
            {t("submit")}
          </button>
        </div>
      )}

      {stage === "reveal" && currentItem && lastResult && (
        <div className="w-full max-w-md text-center space-y-4">
          <p className="text-xs text-neutral-400">
            {t("round", { current: roundIndex + 1, total: rounds.length })}
          </p>
          <div className="w-full h-56 bg-neutral-100 rounded-2xl flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/game/${currentItem.file}`} alt="" className="max-w-full max-h-full object-contain" />
          </div>
          <p className="text-3xl font-semibold text-ink">{t("points", { points: lastResult.points })}</p>
          <p className="text-sm text-neutral-600">
            {lastResult.withinRange ? t("withinRange") : t("notWithinRange")}
          </p>
          <GameReveal item={currentItem} />
          <button onClick={nextRound} className="w-full rounded-full bg-ink text-white py-3 font-medium">
            {roundIndex + 1 >= rounds.length ? t("seeScore") : t("nextRound")}
          </button>
        </div>
      )}

      {stage === "final" && (
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-2xl font-semibold text-ink">{t("finalTitle")}</h1>
          <p className="text-4xl font-semibold text-ink">
            {totalScore} / {rounds.length * 100}
          </p>

          {comparison && challengeScore !== null && (
            <p className="text-sm font-medium text-ink bg-neutral-100 rounded-lg px-3 py-2">
              {t(`compare${comparison === "won" ? "Won" : comparison === "lost" ? "Lost" : "Tied"}`, {
                score: challengeScore,
              })}
            </p>
          )}

          <div className="space-y-3">
            <button onClick={shareChallenge} className="w-full rounded-full border border-neutral-300 text-ink py-3 font-medium">
              {shareState === "copied" ? t("linkCopied") : t("shareChallenge")}
            </button>
            <button onClick={() => start(false)} className="w-full rounded-full bg-ink text-white py-4 font-medium">
              {t("playAgain")}
            </button>
          </div>

          <Link href="/" className="block text-sm text-neutral-500 underline">
            {t("backHome")}
          </Link>
        </div>
      )}
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={null}>
      <GameContent />
    </Suspense>
  );
}
