"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { fileToResizedImage } from "@/lib/image";
import AuthGate from "@/components/AuthGate";
import PhotoInput from "@/components/PhotoInput";
import type { ImageInput } from "@/lib/types";

type Stage = "form" | "creating" | "created" | "error";

function localizedPath(locale: string, path: string): string {
  // Mirrors i18n/routing.ts's localePrefix: "as-needed" — the default
  // locale (fr) stays unprefixed, others get /{locale} — needed here
  // because the share link must be an absolute URL, not a <Link href>.
  return locale === "fr" ? path : `/${locale}${path}`;
}

function NewChallengeForm() {
  const t = useTranslations("game.new");
  const tGame = useTranslations("game");
  const locale = useLocale();
  const [stage, setStage] = useState<Stage>("form");
  const [image, setImage] = useState<ImageInput | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [label, setLabel] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  async function handleFile(file: File) {
    try {
      const resized = await fileToResizedImage(file);
      setImage(resized.image);
      setPreview(resized.previewUrl);
    } catch {
      // Keep the form as-is — the user can just try another photo.
    }
  }

  async function submit() {
    if (!image) return;
    const value = Number(price.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return;

    setStage("creating");
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: image, truePrice: value, currency, label: label.trim() || undefined }),
      });
      if (!res.ok) throw new Error("request_failed");
      const data: { id: string } = await res.json();
      setShareUrl(`${window.location.origin}${localizedPath(locale, `/game/c/${data.id}`)}`);
      setStage("created");
    } catch {
      setStage("error");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2500);
    } catch {
      // Clipboard access blocked — nothing else to fall back to here.
    }
  }

  if (stage === "created") {
    return (
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold text-ink">{t("createdTitle")}</h1>
        <p className="text-neutral-600 text-sm">{t("createdText")}</p>
        <button onClick={share} className="w-full rounded-full bg-ink text-white py-4 font-medium">
          {shareState === "copied" ? t("linkCopied") : t("share")}
        </button>
        <Link href="/game" className="block text-sm text-neutral-500 underline">
          {tGame("backHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">{t("title")}</h1>
      <p className="text-neutral-600 text-sm">{t("subtitle")}</p>

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="w-48 h-48 object-cover rounded-2xl mx-auto" />
      ) : (
        <div className="space-y-3 pt-2">
          <PhotoInput label={t("takePhoto")} capture onSelect={handleFile} />
          <PhotoInput label={t("importPhoto")} variant="secondary" onSelect={handleFile} />
        </div>
      )}

      {image && (
        <div className="space-y-3 text-left pt-2">
          <div>
            <label className="text-sm text-neutral-600 block mb-1">{t("priceLabel")}</label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t("pricePlaceholder")}
                className="flex-1 rounded-lg border border-neutral-300 p-3 text-lg"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-lg border border-neutral-300 px-2"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-neutral-600 block mb-1">{t("labelLabel")}</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
              maxLength={120}
              className="w-full rounded-lg border border-neutral-300 p-3"
            />
          </div>
          <button
            onClick={submit}
            disabled={stage === "creating" || price.trim().length === 0}
            className="w-full rounded-full bg-ink text-white py-3 font-medium disabled:opacity-50"
          >
            {stage === "creating" ? t("creating") : t("submit")}
          </button>
          {stage === "error" && <p className="text-xs text-red-600 text-center">{t("error")}</p>}
        </div>
      )}
    </div>
  );
}

export default function NewChallengePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      <AuthGate>
        <NewChallengeForm />
      </AuthGate>
    </main>
  );
}
