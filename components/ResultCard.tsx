"use client";

import { useState } from "react";
import type { ObjectAnalysis } from "@/lib/schema";

const PRICE_TYPE_LABELS: Record<string, string> = {
  retail_new: "neuf",
  marketplace_asking: "annonce",
  confirmed_sold: "vendu",
};

const CONDITION_LABELS: Record<string, string> = {
  new_sealed: "Neuf / scellé",
  like_new: "Comme neuf",
  excellent: "Excellent état",
  good: "Bon état",
  fair: "État correct",
  poor: "Mauvais état",
  for_parts: "Pour pièces",
  unknown: "État indéterminé",
};

// Percentages imply a calibration we don't have (see project.md, principe 5)
// — a qualitative bucket is honest about what a single scan's confidence
// score actually means.
function confidenceLabel(n: number): string {
  if (n >= 0.75) return "Élevée";
  if (n >= 0.4) return "Moyenne";
  return "Faible";
}

function money(n: number | null, currency: string): string {
  if (n === null) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

// A single-sided estimate ("we found a floor but no ceiling", or vice
// versa) is a real, honest state — rendering it as "45 € – —" reads as
// broken rather than intentional (project.md, note mineure sur R2).
function formatEstimateRange(low: number | null, high: number | null, currency: string): string {
  if (low !== null && high !== null) return `${money(low, currency)} – ${money(high, currency)}`;
  if (low !== null) return `à partir de ${money(low, currency)}`;
  if (high !== null) return `jusqu'à ${money(high, currency)}`;
  return "";
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
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");

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
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-5 space-y-4">
        {hasAnyPrice ? (
          <>
            {analysis.retail_price_new !== null && (
              <div>
                <p className="text-xs text-neutral-500">Prix neuf</p>
                <p className="text-lg font-medium text-ink">
                  {money(analysis.retail_price_new, analysis.currency)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-neutral-500">Estimation occasion</p>
              {hasEstimate ? (
                <p className="text-3xl font-semibold text-ink">
                  {formatEstimateRange(analysis.estimated_value_low, analysis.estimated_value_high, analysis.currency)}
                </p>
              ) : (
                <p className="text-sm text-neutral-500">Non estimée pour cet objet.</p>
              )}
            </div>
          </>
        ) : (
          <div>
            <p className="text-xs text-neutral-500">Prix</p>
            <p className="text-sm text-neutral-600">
              Aucun prix disponible pour cet objet — les références trouvées n&apos;étaient pas
              suffisantes pour donner une estimation honnête.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-neutral-100 pt-4">
          <div>
            <p className="text-neutral-500">Confiance identification</p>
            <p className="font-medium">{confidenceLabel(analysis.identification_confidence)}</p>
          </div>
          <div>
            <p className="text-neutral-500">Confiance du prix</p>
            <p className="font-medium">{hasAnyPrice ? confidenceLabel(analysis.price_confidence) : "—"}</p>
          </div>
        </div>

        <p className="text-xs text-neutral-400">
          État estimé : {CONDITION_LABELS[analysis.condition] ?? analysis.condition} (confiance{" "}
          {confidenceLabel(analysis.condition_confidence).toLowerCase()})
        </p>
      </div>

      {analysis.reasoning_summary.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-ink mb-2">Pourquoi ce résultat ?</h2>
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
            Sources de prix ({analysis.price_sources.length})
          </h2>
          <p className="text-xs text-neutral-400 mb-2">
            Prix demandés (annonces) sauf mention contraire — jamais présentés comme des ventes
            confirmées sans preuve explicite. Date non garantie : ces prix viennent d&apos;une
            recherche web et peuvent ne pas refléter le marché du jour.
          </p>
          <ul className="text-sm space-y-1">
            {analysis.price_sources.map((s, i) => (
              <li key={i} className="flex justify-between gap-2">
                <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 truncate">
                  {s.title}
                </a>
                <span className="text-neutral-500 shrink-0 flex items-center gap-1">
                  {s.price !== null ? money(s.price, s.currency) : "—"}
                  <span className="text-[10px] uppercase text-neutral-400">
                    {PRICE_TYPE_LABELS[s.price_type] ?? s.price_type}
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
              Ce n&apos;est pas le bon objet, ou une précision à ajouter ?
            </button>
          ) : (
            <div className="space-y-2">
              <label htmlFor="correction" className="text-sm text-neutral-600 block">
                Dites-nous ce qui ne va pas (ex : « c&apos;est une Adidas, pas une Nike »)
              </label>
              <textarea
                id="correction"
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                maxLength={500}
                rows={2}
                disabled={correctionDisabled}
                className="w-full rounded-lg border border-neutral-300 p-2 text-sm disabled:opacity-50"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitCorrection}
                  disabled={correctionDisabled || correctionText.trim().length === 0}
                  className="rounded-full bg-ink text-white text-sm py-2 px-4 font-medium disabled:opacity-50"
                >
                  Renvoyer avec cette précision
                </button>
                <button
                  onClick={() => setShowCorrection(false)}
                  disabled={correctionDisabled}
                  className="text-sm text-neutral-500 underline disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={onScanAnother} className="w-full rounded-full bg-ink text-white py-3 font-medium">
        Scanner un autre objet
      </button>
    </div>
  );
}
