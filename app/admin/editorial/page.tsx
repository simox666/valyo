import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { editorialOverview } from "@/lib/data/editorial";
import { listActiveThemes } from "@/lib/data/themes";
import { formatMicros } from "@/lib/editorial/budget.ts";
import { REVIEW_REASON_LABELS, type ReviewReason } from "@/lib/editorial/types.ts";
import { LocalTime } from "@/components/LocalTime";
import { AddSourceForm, ClearEstimationButton, ConfigForm, SourceToggle, TaskActions } from "./AdminForms";

export const metadata: Metadata = { title: "Agent éditorial", robots: { index: false } };

const RECAP_STATES: Record<string, string> = {
  planned: "En préparation",
  draft: "Brouillon",
  ready: "Brouillon validé (non publié)",
  review_required: "À examiner",
  published: "Publié",
  withdrawn: "Retiré",
  missed: "Créneau manqué",
  empty: "Vide (aucune nouvelle retenue)",
};

const reasonLabel = (code: string | null) =>
  code ? (REVIEW_REASON_LABELS[code as ReviewReason] ?? { perime: "Hors fraîcheur", non_retenu_au_tri: "Écarté au tri", non_retenu_plafond: "Au-delà du plafond", tri_invalide: "Tri invalide" }[code] ?? code) : "";

function Status({ title, enabled, missing }: { title: string; enabled: boolean; missing: string[] }) {
  return (
    <div className="rounded-card border border-line p-3">
      <p className="font-semibold">
        {title} : <span className={enabled ? "text-accent" : "text-red-700"}>{enabled ? "active" : "désactivée"}</span>
      </p>
      {missing.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-sm text-soft">
          {missing.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </div>
  );
}

export default async function EditorialAdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  const [o, themes] = await Promise.all([editorialOverview(), listActiveThemes()]);
  const c = o.config;
  const toUnits = (micros: number | undefined) => (micros ? String(micros / 1_000_000) : "");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">Agent éditorial</h1>
        <p className="mt-1 text-soft">Brouillons uniquement : aucune publication publique. Aucun appel à Claude tant que le worker n’est pas lancé et que la configuration est incomplète.</p>
        <p className="mt-1 flex flex-wrap gap-4">
          <Link href="/admin/indicateurs" className="btn-link">Indicateurs de la communauté →</Link>
          <Link href="/admin/moderation" className="btn-link">File de modération →</Link>
        </p>
      </div>

      {c.provider === "test" && (
        <p role="note" className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm font-semibold">
          Fournisseur de test déterministe actif : les brouillons et les coûts affichés sont simulés et ne doivent jamais être présentés comme réels.
        </p>
      )}

      <section className="card space-y-3 p-5" aria-labelledby="etat">
        <h2 id="etat" className="text-lg font-bold">État (configuration v{c.version}, mode {c.mode === "draft" ? "brouillon" : "public"})</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Status title="Collecte" {...o.ready.collection} />
          <Status title="Fournisseur (tri, rédaction)" {...o.ready.provider} />
          <Status title="Récapitulatifs" {...o.ready.recap} />
          <Status title="Publication" {...o.ready.publication} />
        </div>
        <p className="text-sm text-soft">
          Le worker s’exécute hors du site : <code>npm run worker</code> (un cycle borné, lancé par le planificateur de l’hébergement).
        </p>
      </section>

      <section className="card p-5" aria-labelledby="budget">
        <h2 id="budget" className="text-lg font-bold">Budget du mois {o.budget.period} (UTC)</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <dt className="text-soft">Plafond</dt><dd className="font-semibold">{formatMicros(o.budget.capMicros, o.budget.currency)}</dd>
          <dt className="text-soft">Dépensé (rapproché)</dt><dd className="font-semibold">{formatMicros(o.budget.settledMicros, o.budget.currency)}</dd>
          <dt className="text-soft">Réservé (en cours ou incertain)</dt><dd className="font-semibold">{formatMicros(o.budget.reservedMicros, o.budget.currency)}</dd>
          <dt className="text-soft">Lots au coût inconnu (incertains)</dt><dd className="font-semibold">{o.budget.uncertainCount}</dd>
        </dl>
        {c.estimationBlocked && (
          <div role="alert" className="mt-3 rounded-card border border-red-200 bg-red-50 p-3 text-sm">
            Un coût réel a dépassé sa réservation : nouvelles soumissions bloquées jusqu’à vérification.
            <ClearEstimationButton />
          </div>
        )}
      </section>

      <section className="card p-5" aria-labelledby="configuration">
        <h2 id="configuration" className="mb-3 text-lg font-bold">Configuration</h2>
        <ConfigForm
          initial={{
            paused: c.paused,
            provider: c.provider,
            model: c.model ?? "",
            inputPrice: toUnits(c.prices?.inputPerMTokMicros),
            outputPrice: toUnits(c.prices?.outputPerMTokMicros),
            currency: c.currency ?? "",
            budgetCap: c.budgetCapMicros === null ? "" : formatMicros(c.budgetCapMicros, null),
            timezone: c.timezone ?? "",
            policy: c.policy ? JSON.stringify(c.policy) : "",
          }}
        />
      </section>

      <section className="card space-y-4 p-5" aria-labelledby="sources">
        <h2 id="sources" className="text-lg font-bold">Sources</h2>
        {o.sources.length === 0 ? (
          <p className="text-soft">Aucune source. Une source ajoutée reste inactive jusqu’au contrôle de ses conditions d’usage.</p>
        ) : (
          <ul className="divide-y divide-line">
            {o.sources.map((s) => (
              <li key={s.id as string} className="space-y-1 py-3">
                <p className="font-semibold">
                  {s.name as string} <span className="chip">{s.active ? "active" : "inactive"}</span>{" "}
                  <span className="text-sm font-normal text-soft">priorité {String(s.priority)} · {s.source_type as string}</span>
                </p>
                <p className="break-all text-sm text-soft">{s.feed_url as string}</p>
                {s.authorization_reference ? (
                  <p className="text-sm text-soft">Autorisation : {s.authorization_reference as string}</p>
                ) : null}
                {s.last_error ? <p className="text-sm text-red-700">Dernière erreur : {s.last_error as string}</p> : null}
                <SourceToggle id={s.id as string} active={Boolean(s.active)} />
              </li>
            ))}
          </ul>
        )}
        <AddSourceForm themes={themes} />
      </section>

      <section className="card p-5" aria-labelledby="recaps">
        <h2 id="recaps" className="text-lg font-bold">Récapitulatifs</h2>
        {o.recaps.length === 0 ? (
          <p className="mt-2 text-soft">Aucun créneau planifié.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {o.recaps.map((r) => (
              <li key={r.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <LocalTime iso={new Date(r.slot_at as string).toISOString()} mode="full" /> — {RECAP_STATES[r.state as string] ?? (r.state as string)}
                  {` · ${r.items} nouvelle${Number(r.items) > 1 ? "s" : ""}`}
                  {Number(r.freshness_dropped) > 0 && ` · ${r.freshness_dropped} écartée(s) pour fraîcheur`}
                  {(r.notes as { motif?: string }).motif && ` · motif : ${(r.notes as { motif: string }).motif}`}
                </span>
                <Link href={`/admin/editorial/recaps/${r.id}`} className="btn-link">Aperçu</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="sujets">
        <h2 id="sujets" className="text-lg font-bold">Sujets</h2>
        <p className="mt-1 text-sm text-soft">{o.subjectCounts.map((s) => `${s.status} : ${s.n}`).join(" · ") || "Aucun sujet."}</p>
        {o.review.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {o.review.map((s) => (
              <li key={s.id as string} className="py-2">
                <p className="font-semibold">{s.title as string}</p>
                <p className="text-soft">
                  {s.status === "duplicate" ? "Doublon d’une publication de membre (non republié)" : `À examiner : ${reasonLabel(s.block_reason as string)}`}
                  {s.refus ? ` — ${s.refus as string}` : ""}
                </p>
                {s.url ? <p className="break-all text-muted">{s.url as string}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="taches">
        <h2 id="taches" className="text-lg font-bold">Tâches et lots</h2>
        <p className="mt-1 text-sm text-soft">{o.taskCounts.map((t) => `${t.state} : ${t.n}`).join(" · ") || "Aucune tâche."}</p>
        {o.tasks.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {o.tasks.map((t) => (
              <li key={t.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {t.kind as string} — {t.state as string} (tentatives {String(t.attempts)}/{String(t.max_attempts)})
                  {t.error ? ` — ${(t.error as { message?: string }).message ?? ""}` : ""}
                </span>
                <TaskActions id={t.id as string} state={t.state as string} />
              </li>
            ))}
          </ul>
        )}
        {o.batches.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {o.batches.map((b) => (
              <li key={b.id as string} className="py-2">
                Lot {(b.id as string).slice(0, 8)} — {b.provider as string} — {b.state as string}
                {b.state === "uncertain" && " : soumission incertaine, examen requis avant toute nouvelle tentative"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="journal">
        <h2 id="journal" className="text-lg font-bold">Journal des modifications</h2>
        <ul className="mt-2 divide-y divide-line text-sm">
          {o.revisions.map((r, i) => (
            <li key={i} className="py-2">
              <LocalTime iso={new Date(r.created_at as string).toISOString()} mode="full" /> — {r.actor_label as string} — {r.entity as string} : {r.reason as string}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
