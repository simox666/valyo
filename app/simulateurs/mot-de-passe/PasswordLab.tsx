"use client";

import { useState } from "react";
import { Stat, fr } from "@/components/sim/ui";
import { ATTACKERS, analyse, crackLog10Seconds, formatDuration } from "@/lib/simulateurs/mot-de-passe.ts";

const EXAMPLES = ["soleil", "Marseille13", "Tr0ub4dor&3", "cheval-agrafe-pile-correct"];

export function PasswordLab() {
  const [password, setPassword] = useState("");
  const result = analyse(password);
  const combos = result.log10 < 15 ? fr(Math.round(10 ** result.log10), 0) : `1 suivi de ${Math.floor(result.log10)} zéros`;
  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-5">
        <label htmlFor="essai" className="label">Un mot de passe inventé</label>
        <input id="essai" type="text" value={password} onChange={(e) => setPassword(e.target.value.slice(0, 64))} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="Tapez ici, ou choisissez un exemple" className="field font-mono" />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setPassword(e)} className="inline-flex min-h-9 items-center rounded-lg bg-white px-2.5 font-mono text-xs ring-1 ring-line hover:ring-ink">{e}</button>)}
        </div>
        <p className="text-xs text-muted">Rien ne quitte votre appareil. N’entrez pas un mot de passe que vous utilisez vraiment.</p>
      </section>
      {result.length > 0 && (
        <section className="card space-y-4 p-5" aria-live="polite">
          <dl className="grid grid-cols-3 gap-2">
            <Stat label="Longueur" value={`${result.length}`} detail="caractères" />
            <Stat label="Alphabet" value={`${result.pool}`} detail="signes possibles" />
            <Stat label="Essais" value={result.log10 < 15 ? combos : `10^${Math.floor(result.log10)}`} detail={result.log10 < 15 ? undefined : combos} />
          </dl>
          <div>
            <p className="label-mono text-accent">Temps pour le trouver</p>
            <ul className="mt-2 divide-y divide-hairline">
              {ATTACKERS.map((a) => {
                const duration = formatDuration(crackLog10Seconds(result.log10, a.rate), result.common);
                return (
                  <li key={a.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                    <span className="min-w-0 text-sm"><span className="font-semibold">{a.name}</span> <span className="text-muted">· {a.detail}</span></span>
                    <span className={`font-display text-lg font-bold ${duration === "instantané" ? "text-red-700" : ""}`}>{duration}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          {result.warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {result.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
          <p className="text-sm text-soft">
            Le plus efficace : une phrase de quatre ou cinq mots sans rapport entre eux, différente pour chaque site, rangée dans un gestionnaire de mots de passe, avec la double authentification activée.
          </p>
        </section>
      )}
    </div>
  );
}
