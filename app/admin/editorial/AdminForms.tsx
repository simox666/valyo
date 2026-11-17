"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(method: string, url: string, body: unknown, success: string) {
    setBusy(true);
    setMessage(null);
    const result = await api(method, url, body);
    setBusy(false);
    setMessage(result.ok ? { ok: true, text: success } : { ok: false, text: result.data.error ?? "Action impossible." });
    if (result.ok) router.refresh();
    return result.ok;
  }
  const feedback = message && (
    <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm font-semibold text-accent" : "error-text"}>
      {message.text}
    </p>
  );
  return { busy, run, feedback };
}

export interface ConfigValues {
  paused: boolean;
  provider: string;
  model: string;
  inputPrice: string;
  outputPrice: string;
  currency: string;
  budgetCap: string;
  timezone: string;
  policy: string;
}

const toMicros = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(",", ".")) * 1_000_000));

export function ConfigForm({ initial }: { initial: ConfigValues }) {
  const [v, setV] = useState(initial);
  const [reason, setReason] = useState("");
  const [policyError, setPolicyError] = useState<string | null>(null);
  const { busy, run, feedback } = useAction();
  const set = (k: keyof ConfigValues, value: string | boolean) => setV({ ...v, [k]: value });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    let policy: unknown = null;
    if (v.policy.trim()) {
      try {
        policy = JSON.parse(v.policy);
        setPolicyError(null);
      } catch {
        setPolicyError("JSON invalide.");
        return;
      }
    }
    const input = toMicros(v.inputPrice);
    const output = toMicros(v.outputPrice);
    await run(
      "PATCH",
      "/api/admin/editorial/config",
      {
        reason,
        paused: v.paused,
        provider: v.provider,
        model: v.model || null,
        prices: input && output ? { inputPerMTokMicros: input, outputPerMTokMicros: output } : null,
        currency: v.currency || null,
        budgetCap: v.budgetCap || null,
        timezone: v.timezone || null,
        policy,
      },
      "Configuration enregistrée.",
    );
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <label className="flex items-center gap-3 font-semibold">
        <input type="checkbox" className="h-5 w-5 accent-[#1C4F3C]" checked={v.paused} onChange={(e) => set("paused", e.target.checked)} />
        Agent en pause (aucune nouvelle soumission ni publication)
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="provider" className="label">Fournisseur</label>
          <select id="provider" className="field" value={v.provider} onChange={(e) => set("provider", e.target.value)}>
            <option value="none">Aucun</option>
            <option value="test">Fournisseur de test déterministe</option>
            <option value="claude">Claude (traitement par lots ; aucun appel sans plafond, prix et modèle)</option>
          </select>
        </div>
        <div>
          <label htmlFor="model" className="label">Modèle (D3, à confirmer dans la documentation officielle)</label>
          <input id="model" className="field" value={v.model} onChange={(e) => set("model", e.target.value)} />
        </div>
        <div>
          <label htmlFor="inputPrice" className="label">Prix d’entrée vérifié, par million de jetons</label>
          <input id="inputPrice" inputMode="decimal" className="field" value={v.inputPrice} onChange={(e) => set("inputPrice", e.target.value)} />
        </div>
        <div>
          <label htmlFor="outputPrice" className="label">Prix de sortie vérifié, par million de jetons</label>
          <input id="outputPrice" inputMode="decimal" className="field" value={v.outputPrice} onChange={(e) => set("outputPrice", e.target.value)} />
        </div>
        <div>
          <label htmlFor="currency" className="label">Devise (USD, EUR…)</label>
          <input id="currency" className="field" value={v.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
        </div>
        <div>
          <label htmlFor="budgetCap" className="label">Plafond mensuel (mois UTC)</label>
          <input id="budgetCap" inputMode="decimal" className="field" value={v.budgetCap} onChange={(e) => set("budgetCap", e.target.value)} />
        </div>
        <div>
          <label htmlFor="timezone" className="label">Fuseau de planification</label>
          <input id="timezone" className="field" placeholder="Europe/Brussels" value={v.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="policy" className="label">Politique des récapitulatifs (JSON)</label>
        <p className="hint mb-1">
          Jours, heures et taille restent des propositions D8 non validées : ne remplir qu’après décision du porteur. Format :
          {" "}<code>{`{"slots":[{"weekday":1,"time":"07:00"}],"maxItems":8,"prepLeadHours":24}`}</code>
        </p>
        <textarea id="policy" rows={3} className={`field font-mono text-sm ${policyError ? "field-invalid" : ""}`} value={v.policy} onChange={(e) => set("policy", e.target.value)} />
        {policyError && <p className="error-text">{policyError}</p>}
      </div>
      <div>
        <label htmlFor="reason" className="label">Motif de la modification (consigné)</label>
        <input id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>Enregistrer</button>
        {feedback}
      </div>
    </form>
  );
}

export function ClearEstimationButton() {
  const { busy, run, feedback } = useAction();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => run("PATCH", "/api/admin/editorial/config", { reason: "Écart d’estimation vérifié", clearEstimationBlock: true }, "Blocage levé.")}>
        J’ai vérifié l’écart : lever le blocage
      </button>
      {feedback}
    </div>
  );
}

export function AddSourceForm({ themes }: { themes: { id: string; name: string }[] }) {
  const [s, setS] = useState({ name: "", feedUrl: "", sourceType: "primary", priority: "1", themeId: themes[0]?.id ?? "" });
  const { busy, run, feedback } = useAction();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(
          "POST",
          "/api/admin/editorial/sources",
          { name: s.name, feedUrl: s.feedUrl, sourceType: s.sourceType, priority: Number(s.priority), themeIds: s.themeId ? [s.themeId] : [] },
          "Source ajoutée, inactive.",
        );
        if (ok) setS({ ...s, name: "", feedUrl: "" });
      }}
    >
      <div>
        <label htmlFor="src-name" className="label">Nom</label>
        <input id="src-name" className="field" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
      </div>
      <div>
        <label htmlFor="src-url" className="label">URL du flux RSS ou Atom</label>
        <input id="src-url" type="url" className="field" value={s.feedUrl} onChange={(e) => setS({ ...s, feedUrl: e.target.value })} />
      </div>
      <div>
        <label htmlFor="src-type" className="label">Type</label>
        <select id="src-type" className="field" value={s.sourceType} onChange={(e) => setS({ ...s, sourceType: e.target.value })}>
          <option value="primary">Source primaire</option>
          <option value="scientific">Publication scientifique</option>
          <option value="press">Presse spécialisée</option>
        </select>
      </div>
      <div>
        <label htmlFor="src-priority" className="label">Priorité (1 = la plus haute)</label>
        <select id="src-priority" className="field" value={s.priority} onChange={(e) => setS({ ...s, priority: e.target.value })}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>
      <div>
        <label htmlFor="src-theme" className="label">Thème</label>
        <select id="src-theme" className="field" value={s.themeId} onChange={(e) => setS({ ...s, themeId: e.target.value })}>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>Ajouter (inactive)</button>
        {feedback}
      </div>
    </form>
  );
}

export function SourceToggle({ id, active }: { id: string; active: boolean }) {
  const [reference, setReference] = useState("");
  const { busy, run, feedback } = useAction();
  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-danger px-3 py-1.5" disabled={busy} onClick={() => run("PATCH", `/api/admin/editorial/sources/${id}`, { active: false, reason: "Désactivation" }, "Source désactivée.")}>
          Désactiver
        </button>
        {feedback}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`ref-${id}`}>Référence du contrôle d’autorisation</label>
      <input id={`ref-${id}`} className="field max-w-xs py-1.5 text-sm" placeholder="Référence du contrôle (conditions, flux officiel…)" value={reference} onChange={(e) => setReference(e.target.value)} />
      <button
        type="button"
        className="btn-secondary px-3 py-1.5"
        disabled={busy || reference.trim().length < 5}
        onClick={() => run("PATCH", `/api/admin/editorial/sources/${id}`, { active: true, authorizationReference: reference, reason: "Activation après contrôle d’autorisation" }, "Source activée.")}
      >
        Activer
      </button>
      {feedback}
    </div>
  );
}

export function TaskActions({ id, state }: { id: string; state: string }) {
  const { busy, run, feedback } = useAction();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {["review_required", "cancelled"].includes(state) && (
        <button type="button" className="btn-link" disabled={busy} onClick={() => run("POST", `/api/admin/editorial/tasks/${id}`, { action: "retry" }, "Relancée.")}>
          Relancer
        </button>
      )}
      {["pending", "review_required"].includes(state) && (
        <button type="button" className="btn-link text-red-700" disabled={busy} onClick={() => run("POST", `/api/admin/editorial/tasks/${id}`, { action: "cancel" }, "Annulée.")}>
          Annuler
        </button>
      )}
      {feedback}
    </span>
  );
}
