import { displayHost, parseHttpUrl } from "@/lib/urls";
import { KIND_LABELS } from "@/lib/validation";
import type { PostFormValues } from "./PostForm";
import { PostGallery } from "./PostGallery";

/** Même contenu que la publication, sans date, activité ou statut inventés. */
export function PostPreview({ values, themes, authorName }: {
  values: PostFormValues;
  themes: { id: string; name: string }[];
  authorName: string;
}) {
  const sources = values.sources.map(source => source.trim()).filter(Boolean);
  const demoUrl = values.kind !== "question" && parseHttpUrl(values.demoUrl)?.href;
  return <article className="card min-w-0 p-5 sm:p-8" aria-label="Aperçu de votre publication">
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-soft">
      <span className="chip bg-accent-soft text-accent">{KIND_LABELS[values.kind]}</span>
      <span className="font-semibold">{authorName}</span>
      <span>· Aperçu avant envoi</span>
    </div>
    <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{values.title.trim()}</h2>
    {values.images && values.images.length > 0 && <div className="mt-4"><PostGallery images={values.images} full /></div>}
    <div className="mt-5 whitespace-pre-wrap leading-relaxed">{values.body.trim()}</div>
    <div className="mt-5 flex flex-wrap gap-2">
      {themes.filter(theme => values.themeIds.includes(theme.id)).map(theme => <span key={theme.id} className="chip">{theme.name}</span>)}
    </div>
    {sources.length > 0 && <section className="mt-6 border-t border-line pt-4">
      <h3 className="label-mono text-soft">Sources</h3>
      <ul className="mt-3 space-y-2">{sources.map((source, index) => <li key={index}>
        {parseHttpUrl(source) ? <a href={source} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn-link">{displayHost(source)} ↗</a> : <span>{source}</span>}
        <span className="mt-0.5 block break-all text-xs text-muted">{source}</span>
      </li>)}</ul>
    </section>}
    {demoUrl && <section className="mt-5 rounded-card bg-accent-soft p-4">
      <a href={demoUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn-primary">Tester ↗</a>
      <p className="mt-2 text-sm text-soft">Service externe ({displayHost(demoUrl)}). Ses conditions d’accès et son éventuel coût ne sont pas vérifiés.</p>
    </section>}
  </article>;
}
