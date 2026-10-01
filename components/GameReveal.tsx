"use client";

import { useLocale, useTranslations } from "next-intl";
import type { GameItem } from "@/lib/game/items";
import { targetRange } from "@/lib/game/items";

const NUMBER_LOCALE: Record<string, string> = {
  fr: "fr-FR",
  en: "en-US",
  nl: "nl-NL",
  es: "es-ES",
};

export default function GameReveal({ item }: { item: GameItem }) {
  const t = useTranslations("game");
  const locale = useLocale();
  const { low, high } = targetRange(item);
  const { analysis } = item;

  function money(n: number, currency: string): string {
    try {
      return new Intl.NumberFormat(NUMBER_LOCALE[locale] ?? "en-US", {
        style: "currency",
        currency,
      }).format(n);
    } catch {
      return `${n} ${currency}`;
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 text-left space-y-2">
      <p className="text-xs text-neutral-500">{t("ourEstimate")}</p>
      <p className="text-xl font-semibold text-ink">
        {money(low, analysis.currency)} – {money(high, analysis.currency)}
      </p>
      {analysis.reasoning_summary.length > 0 && (
        <ul className="text-sm text-neutral-600 list-disc list-inside space-y-1">
          {analysis.reasoning_summary.slice(0, 3).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-neutral-400">{t("notVerified")}</p>
    </div>
  );
}
