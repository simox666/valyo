import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { itemEvidenceValid } from "@/lib/editorial/revision.ts";
import { recapPreview } from "@/lib/data/editorial";
import { SCIENTIFIC_STATUS_LABELS, type ScientificStatus } from "@/lib/editorial/types.ts";
import { displayHost } from "@/lib/urls";
import { LocalTime } from "@/components/LocalTime";
import { DevelopmentRequestButton, RecapReadyButton, RelectureButton, RevisionForm } from "./RevisionForm";

export const metadata: Metadata = { title: "Aperçu du récapitulatif", robots: { index: false } };

// Aperçu administrateur : rendu dérivé des éléments validés uniquement, sans HTML du modèle.
export default async function RecapPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  const data = await recapPreview((await params).id);
  if (!data) notFound();
  const { recap, items } = data;

  return (
    <div className="space-y-6">
      <Link href="/admin/editorial" className="btn-link">← Console de l’agent</Link>
      <p className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm">
        Aperçu non publié (état : {recap.state as string}). Aucune publication publique dans le lot 2A.
      </p>
      {(recap.state as string) === "review_required" && (
        <div className="rounded-card border border-line p-3 text-sm">
          <p className="mb-2">
            Ce brouillon a été révisé : chaque élément modifié doit être relu contre ses sources avant de pouvoir redevenir publiable.
          </p>
          <RecapReadyButton expectedVersion={Number(recap.version)} recapId={recap.id as string} />
        </div>
      )}
      <article className="card p-5 sm:p-6">
        <p className="text-sm text-soft">
          Agent éditorial · créneau du <LocalTime iso={new Date(recap.slot_at as string).toISOString()} mode="full" />
        </p>
        <h1 className="mt-1 text-2xl font-bold">La semaine en sciences et tech</h1>
        {items.length === 0 ? (
          <p className="mt-4 text-soft">Aucune nouvelle retenue : un récapitulatif vide n’est pas publié.</p>
        ) : (
          <ol className="mt-5 space-y-6">
            {items.map((item) => {
              const sources = item.sources as { url: string; title: string }[];
              const verification = item.claims as { statements: { text: string; quote: string }[]; simulated: boolean } | null;
              const revision = item.human_revision as { motif: string; par: string; le: string; relecture?: { par: string; le: string; motif: string } } | null;
              return (
                <li key={item.id as string} id={`n-${item.id}`} className="scroll-mt-20 border-t border-line pt-4">
                  <p className="chip">{SCIENTIFIC_STATUS_LABELS[item.scientific_status as ScientificStatus] ?? "Statut inconnu"}</p>
                  <h2 className="mt-2 text-lg font-bold">
                    <a href={`#n-${item.id}`} className="hover:underline">{item.position as number}. {item.title as string}</a>
                  </h2>
                  <p className="mt-1 leading-relaxed">{item.summary as string}</p>
                  <p className="mt-2 text-sm">
                    Sources :{" "}
                    {sources.map((s, i) => (
                      <span key={s.url}>
                        {i > 0 && " · "}
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-link">{displayHost(s.url)}</a>
                      </span>
                    ))}
                  </p>
                  {verification ? (
                    <details className="mt-2 text-sm text-soft">
                      <summary className="cursor-pointer font-semibold">
                        Vérification de fidélité (administration){verification.simulated ? " — SIMULÉE par le fournisseur de test" : ""}
                      </summary>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {verification.statements.map((s, i) => (
                          <li key={i}>
                            {s.text} <span className="text-muted">← « {s.quote} »</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <div className="mt-2 rounded-card border border-amber-300 bg-amber-50 p-2 text-sm">
                      <p>
                        Vérification de fidélité invalidée par une révision humaine
                        {revision ? <> — motif : {revision.motif} ({revision.par}, <LocalTime iso={new Date(revision.le).toISOString()} mode="full" />)</> : null}.
                      </p>
                      {revision?.relecture && itemEvidenceValid(item as { claims: unknown; human_revision: unknown }) ? (
                        <p className="mt-1 font-semibold">Relu contre les sources par {revision.relecture.par} — {revision.relecture.motif}.</p>
                      ) : (
                        <p className="mt-1"><RelectureButton expectedVersion={Number(recap.version)} itemId={item.id as string} /></p>
                      )}
                    </div>
                  )}
                  {(recap.state as string) !== "published" && (recap.state as string) !== "withdrawn" && (
                    <div className="mt-2">
                      <RevisionForm itemId={item.id as string} initialTitle={item.title as string} initialSummary={item.summary as string} />
                    </div>
                  )}
                  <p className="mt-2 text-sm text-muted">
                    Demandes publiques de développement : indisponibles tant que la règle de déclenchement (D8) n’est pas validée.{" "}
                    <DevelopmentRequestButton itemId={item.id as string} />
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </article>
    </div>
  );
}
