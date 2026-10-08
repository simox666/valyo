"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ObjectAnalysis } from "@/lib/schema";
import { formatMoney } from "@/lib/money";

// Percentages imply a calibration we don't have (see project.md, principe 5)
// — a qualitative bucket is honest about what a single scan's confidence
// score actually means.
function confidenceKey(n: number): "high" | "medium" | "low" {
  if (n >= 0.75) return "high";
  if (n >= 0.4) return "medium";
  return "low";
}

export default function ResultCard({
  analysis,
  onScanAnother,
  onCorrect,
  correctionDisabled,
}: {
  analysis: ObjectAnalysis;
  onScanAnother: () => void;
  onCorrect?: (note: string) => void;
  correctionDisabled?: boolean;
}) {
  const t = useTranslations("result");
  const locale = useLocale();
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");

  function money(n: number | null, currency: string): string {
    if (n === null) return "—";
    return formatMoney(n, currency, locale);
  }

  // A single-sided estimate ("we found a floor but no ceiling", or vice
  // versa) is a real, honest state — rendering it as "45 € – —" reads as
  // broken rather than intentional (project.md, note mineure sur R2).
  function formatEstimateRange(low: number | null, high: number | null, currency: string): string {
    if (low !== null && high !== null) return `${money(low, currency)} – ${money(high, currency)}`;
    if (low !== null) return t("estimateFrom", { amount: money(low, currency) });
    if (high !== null) return t("estimateUpTo", { amount: money(high, currency) });
    return "";
  }

  const title = [analysis.brand, analysis.model, analysis.variant].filter(Boolean).join(" ") || analysis.category;
  const hasAnyPrice =
    analysis.retail_price_new !== null ||
    analysis.estimated_value_low !== null ||
    analysis.estimated_value_high !== null;
  const hasEstimate = analysis.estimated_value_low !== null || analysis.estimated_value_high !== null;

  function submitCorrection() {
    const note = correctionText.trim();
    if (note.length === 0 || !onCorrect) return;
    onCorrect(note);
    setShowCorrection(false);
    setCorrectionText("");
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div>
        {analysis.brand && (
          <p className="text-sm uppercase tracking-wide text-neutral-500">{analysis.brand}</p>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
      </div>

      <div className="rounded-2xl border border-line p-5 space-y-4">
        {hasAnyPrice ? (
          <>
            {analysis.retail_price_new !== null && (
              <div>
                <p className="text-xs text-neutral-500">{t("retailPrice")}</p>
                <p className="text-lg font-medium text-ink">
                  {money(analysis.retail_price_new, analysis.currency)}
                </p>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-neutral-500">{t("estimateLabel")}</p>
                {analysis.price_basis === "general_estimate" && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                    {t("generalEstimateBadge")}
                  </span>
                )}
              </div>
              {hasEstimate ? (
                <p className="text-3xl font-extrabold tracking-tight text-ink">
                  {formatEstimateRange(analysis.estimated_value_low, analysis.estimated_value_high, analysis.currency)}
                </p>
              ) : (
                <p className="text-sm text-neutral-500">{t("notEstimated")}</p>
              )}
              {analysis.price_basis === "general_estimate" && (
                <p className="text-xs text-neutral-400 mt-1">{t("generalEstimateCaveat")}</p>
              )}
            </div>
          </>
        ) : (
          <div>
            <p className="text-xs text-neutral-500">{t("noPriceLabel")}</p>
            <p className="text-sm text-neutral-600">{t("noPriceText")}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-neutral-100 pt-4">
          <div>
            <p className="text-neutral-500">{t("idConfidence")}</p>
            <p className="font-medium">{t(`confidence.${confidenceKey(analysis.identification_confidence)}`)}</p>
          </div>
          <div>
            <p className="text-neutral-500">{t("priceConfidence")}</p>
            <p className="font-medium">
              {hasAnyPrice ? t(`confidence.${confidenceKey(analysis.price_confidence)}`) : "—"}
            </p>
          </div>
        </div>

        <p className="text-xs text-neutral-400">
          {t("conditionLabel", {
            condition: t(`condition.${analysis.condition}`),
            confidence: t(`confidence.${confidenceKey(analysis.condition_confidence)}`).toLowerCase(),
          })}
        </p>
      </div>

      {analysis.reasoning_summary.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-ink mb-2">{t("why")}</h2>
          <ul className="text-sm text-neutral-600 space-y-1 list-disc list-inside">
            {analysis.reasoning_summary.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.price_sources.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-ink mb-2">
            {t("sources", { count: analysis.price_sources.length })}
          </h2>
          <p className="text-xs text-neutral-400 mb-2">{t("sourcesCaveat")}</p>
          <ul className="text-sm space-y-1">
            {analysis.price_sources.map((s, i) => (
              <li key={i} className="flex justify-between gap-2">
                <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 truncate">
                  {s.title}
                </a>
                <span className="text-neutral-500 shrink-0 flex items-center gap-1">
                  {s.price !== null ? money(s.price, s.currency) : "—"}
                  <span className="text-[10px] uppercase text-neutral-400">
                    {t(`priceType.${s.price_type}`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onCorrect && (
        <div className="border-t border-neutral-100 pt-4">
          {!showCorrection ? (
            <button
              onClick={() => setShowCorrection(true)}
              disabled={correctionDisabled}
              className="text-sm text-neutral-500 underline disabled:opacity-50"
            >
              {t("wrongObject")}
            </button>
          ) : (
            <div className="space-y-2">
              <label htmlFor="correction" className="text-sm text-neutral-600 block">
                {t("correctionLabel")}
              </label>
              <textarea
                id="correction"
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                maxLength={500}
                rows={2}
                disabled={correctionDisabled}
                className="w-full rounded-xl border border-line p-2 text-sm disabled:opacity-50"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitCorrection}
                  disabled={correctionDisabled || correctionText.trim().length === 0}
                  className="rounded-xl bg-accent text-white text-sm py-2 px-4 font-semibold disabled:opacity-50"
                >
                  {t("resend")}
                </button>
                <button
                  onClick={() => setShowCorrection(false)}
                  disabled={correctionDisabled}
                  className="text-sm text-neutral-500 underline disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={onScanAnother} className="w-full rounded-2xl bg-accent text-white py-[15px] font-semibold">
        {t("scanAnother")}
      </button>
    </div>
  );
}
