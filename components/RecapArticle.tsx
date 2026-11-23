import Link from "next/link";
import { SCIENTIFIC_STATUS_LABELS, type ScientificStatus } from "@/lib/editorial/types.ts";
import { displayHost } from "@/lib/urls";
import { LocalTime } from "./LocalTime";

// Rendu public structuré d'un récapitulatif publié (lot d'accélération A9) :
// nouvelles numérotées avec ANCRE STABLE (#n-<id de l'élément>, invariable d'une
// version à l'autre), statut scientifique affiché, sources par nouvelle (sans
// limite au nombre de sources des membres), correction éditoriale signalée.

export interface RecapItemView {
  id: string;
  position: number;
  title: string;
  summary: string;
  scientificStatus: string;
  sources: { url: string; title: string }[];
  correction: { motif: string; le: string } | null;
  /** Relation réciproque : article de développement publié pour cette nouvelle. */
  developmentPostId: string | null;
}

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer nofollow ugc" } as const;

export function RecapArticle({ items }: { items: RecapItemView[] }) {
  return (
    <div className="mt-4 space-y-2">
      <p className="rounded-card bg-accent-soft p-3 text-sm">
        Récapitulatif rédigé automatiquement par l’agent éditorial à partir des sources citées, puis vérifié. Signalez toute erreur : elle sera
        corrigée ou retirée.
      </p>
      <ol className="space-y-6">
        {items.map((item) => (
          <li key={item.id} id={`n-${item.id}`} className="scroll-mt-20 border-t border-line pt-4">
            <p className="chip">{SCIENTIFIC_STATUS_LABELS[item.scientificStatus as ScientificStatus] ?? "Statut inconnu"}</p>
            <h2 className="mt-2 text-lg font-bold">
              <a href={`#n-${item.id}`} className="hover:underline">
                {item.position}. {item.title}
              </a>
            </h2>
            <p className="mt-1 leading-relaxed">{item.summary}</p>
            <p className="mt-2 text-sm">
              Sources :{" "}
              {item.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && " · "}
                  <a href={s.url} {...EXTERNAL} className="btn-link">
                    {displayHost(s.url)}
                  </a>
                </span>
              ))}
            </p>
            {item.developmentPostId && (
              <p className="mt-2 text-sm">
                <Link href={`/p/${item.developmentPostId}`} className="btn-link">Lire le développement de cette nouvelle →</Link>
              </p>
            )}
            {item.correction && (
              <p className="mt-2 text-sm italic text-soft">
                Corrigé le <LocalTime iso={new Date(item.correction.le).toISOString()} mode="full" /> — {item.correction.motif}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
