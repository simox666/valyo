"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AuthGate from "@/components/AuthGate";

interface ChallengeData {
  id: string;
  photoUrl: string;
  label: string | null;
  currency: string;
  isCreator: boolean;
  truePrice: number | null;
  yourGuess: number | null;
  yourPoints: number | null;
  yourTotalPoints: number | null;
}

interface GuessResult {
  points: number;
  withinTolerance: boolean;
  truePrice: number;
  totalPoints: number;
}

function ChallengeContent() {
  const t = useTranslations("game.challenge");
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ChallengeData | "loading" | "not_found">("loading");
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<GuessResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/challenges/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not_found"))))
      .then((json: ChallengeData) => setData(json))
      .catch(() => setData("not_found"));
  }, [params.id]);

  async function submitGuess() {
    const value = Number(guess.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/challenges/${params.id}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guessValue: value }),
      });
      if (!res.ok) throw new Error("request_failed");
      const json: GuessResult = await res.json();
      setResult(json);
    } catch {
      // Keep the form as-is so the player can retry.
    } finally {
      setBusy(false);
    }
  }

  if (data === "loading") return <p className="text-neutral-600 text-center">{t("loading")}</p>;
  if (data === "not_found") return <p className="text-neutral-600 text-center">{t("notFound")}</p>;

  const revealed: { points: number; truePrice: number; withinTolerance: boolean; totalPoints: number | null } | null =
    result ?? (data.truePrice !== null ? { points: data.yourPoints ?? 0, truePrice: data.truePrice, withinTolerance: (data.yourPoints ?? 0) >= 100, totalPoints: data.yourTotalPoints } : null);

  return (
    <div className="w-full max-w-md space-y-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.photoUrl} alt={data.label ?? ""} className="w-full h-64 object-cover rounded-2xl" />
      {data.label && <p className="text-lg font-medium text-ink">{data.label}</p>}

      {data.isCreator ? (
        <p className="text-sm text-neutral-500">{t("ownChallengeNotice")}</p>
      ) : revealed ? (
        <div className="space-y-2">
          <p className="text-3xl font-semibold text-ink">{t("resultTitle", { points: revealed.points })}</p>
          <p className="text-sm text-neutral-600">
            {revealed.withinTolerance ? t("withinTolerance") : t("notWithinTolerance")}
          </p>
          <p className="text-sm text-neutral-500">
            {t("truePriceLabel")}: {revealed.truePrice} {data.currency}
          </p>
          {revealed.totalPoints !== null && (
            <p className="text-xs text-neutral-400">
              {t("totalPointsLabel")}: {revealed.totalPoints}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">{t("guessTitle")}</p>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={t("guessPlaceholder", { currency: data.currency })}
            className="w-full rounded-lg border border-neutral-300 p-3 text-center text-lg"
          />
          <button
            onClick={submitGuess}
            disabled={busy || guess.trim().length === 0}
            className="w-full rounded-full bg-ink text-white py-3 font-medium disabled:opacity-50"
          >
            {t("submit")}
          </button>
        </div>
      )}

      <Link href="/game/new" className="block text-sm text-neutral-500 underline">
        {t("createOwn")}
      </Link>
    </div>
  );
}

export default function ChallengePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      <AuthGate>
        <ChallengeContent />
      </AuthGate>
    </main>
  );
}
