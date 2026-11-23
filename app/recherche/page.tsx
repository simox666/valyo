import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { searchAll } from "@/lib/data/search";
import { LocalTime } from "@/components/LocalTime";
import { KIND_LABELS } from "@/lib/validation";

export const metadata: Metadata = { robots: { index: false }, title: "Recherche" };

// Recherche (D28) : publications, membres, thèmes et salons PUBLICS, par type,
// avec pagination simple par type (?pp=, pm=, pt=, ps=). Jamais de salon privé.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pp?: string; pm?: string; pt?: string; ps?: string }>;
}) {
  const { q = "", pp, pm, pt, ps } = await searchParams;
  const user = await getCurrentUser();
  const pages = { posts: Number(pp ?? 0) || 0, members: Number(pm ?? 0) || 0, themes: Number(pt ?? 0) || 0, rooms: Number(ps ?? 0) || 0 };
  const results = q ? await searchAll(q, user?.id ?? null, pages) : null;
  const base = `/recherche?q=${encodeURIComponent(q)}`;
  const more = (param: string, page: number) => `${base}&${param}=${page + 1}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Recherche</h1>
      <form action="/recherche" method="get" className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Rechercher</label>
        <input id="q" name="q" defaultValue={q} minLength={2} maxLength={100} placeholder="Publications, membres, thèmes, salons publics…" className="input flex-1" />
        <button type="submit" className="btn-primary px-4 py-2">Rechercher</button>
      </form>

      {q && !results && <p className="card p-5 text-soft">Saisissez au moins deux caractères.</p>}
      {/* Audit UX (P2-4) : seules les sections AVEC résultats s'affichent ; un état vide global sinon. */}
      {results && results.posts.items.length + results.members.items.length + results.themes.items.length + results.rooms.items.length === 0 && (
        <div className="card p-6 text-center">
          <p className="font-semibold">Aucun résultat pour « {results.query} ».</p>
          <p className="mt-1 text-sm text-soft">Essayez un autre mot, un pseudonyme ou un thème. Les salons sur invitation ne sont jamais listés ici.</p>
        </div>
      )}
      {results && (
        <>
          {results.posts.items.length > 0 && <section className="card p-5" aria-labelledby="r-posts">
            <h2 id="r-posts" className="text-lg font-bold">Publications</h2>
            {(
              <ul className="mt-1 divide-y divide-line">
                {results.posts.items.map((p) => (
                  <li key={p.id} className="py-2">
                    <span className="chip mr-2">{KIND_LABELS[p.kind as keyof typeof KIND_LABELS] ?? p.kind}</span>
                    <Link href={`/p/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>
                    <span className="ml-2 text-sm text-muted">{p.authorName} · <LocalTime iso={p.createdAt} /></span>
                  </li>
                ))}
              </ul>
            )}
            {results.posts.hasMore && <Link href={more("pp", pages.posts)} className="btn-link mt-2 inline-block">Publications suivantes →</Link>}
          </section>}

          {results.members.items.length > 0 && <section className="card p-5" aria-labelledby="r-membres">
            <h2 id="r-membres" className="text-lg font-bold">Membres</h2>
            {(
              <ul className="mt-1 divide-y divide-line">
                {results.members.items.map((m) => (
                  <li key={m.handle} className="py-2">
                    <Link href={`/m/${m.handle}`} className="font-semibold hover:underline">{m.displayName || m.handle}</Link>
                    <span className="ml-2 text-sm text-muted">@{m.handle}</span>
                    {m.bio && <p className="text-sm text-soft">{m.bio}</p>}
                  </li>
                ))}
              </ul>
            )}
            {results.members.hasMore && <Link href={more("pm", pages.members)} className="btn-link mt-2 inline-block">Membres suivants →</Link>}
          </section>}

          {results.themes.items.length > 0 && <section className="card p-5" aria-labelledby="r-themes">
            <h2 id="r-themes" className="text-lg font-bold">Thèmes</h2>
            {(
              <ul className="mt-2 flex flex-wrap gap-2">
                {results.themes.items.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/?theme=${t.slug}`} className="chip hover:bg-line">{t.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>}

          {results.rooms.items.length > 0 && <section className="card p-5" aria-labelledby="r-salons">
            <h2 id="r-salons" className="text-lg font-bold">Salons publics</h2>
            {(
              <ul className="mt-1 divide-y divide-line">
                {results.rooms.items.map((r) => (
                  <li key={r.id} className="py-2">
                    <Link href={`/s/${r.id}`} className="font-semibold hover:underline">{r.name}</Link>
                    <span className="ml-2 text-sm text-muted">{r.members} membre{r.members > 1 ? "s" : ""}</span>
                    {r.description && <p className="text-sm text-soft">{r.description}</p>}
                  </li>
                ))}
              </ul>
            )}
            {results.rooms.hasMore && <Link href={more("ps", pages.rooms)} className="btn-link mt-2 inline-block">Salons suivants →</Link>}
          </section>}
        </>
      )}
    </div>
  );
}
