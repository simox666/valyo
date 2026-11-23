import type { Metadata } from "next";
import Link from "next/link";
import { getSyntheses } from "@/lib/actus/synthesis.ts";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEED_PAGE, listFeed } from "@/lib/data/posts";
import { followedThemeIds, getThemeBySlug } from "@/lib/data/themes";
import { linkedRooms } from "@/lib/rooms/discovery.ts";
import { reactionSummaries } from "@/lib/social/reactions.ts";
import { themeOverview } from "@/lib/social/theme-page.ts";
import { themesWithGames } from "@/lib/jeux/questions";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { PostCard } from "@/components/PostCard";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const theme = await getThemeBySlug((await params).slug);
  return theme
    ? { title: theme.name, description: theme.description, alternates: { canonical: `/theme/${theme.slug}` } }
    : { title: "Thème introuvable", robots: { index: false } };
}

export default async function ThemePage({ params, searchParams }: { params: Params; searchParams: Promise<{ n?: string }> }) {
  const { slug } = await params;
  const theme = await getThemeBySlug(slug);
  if (!theme) notFound();
  const user = await getCurrentUser();
  const signedIn = Boolean(user?.onboarded);
  const limit = Math.min(Math.max(Number.parseInt((await searchParams).n ?? "", 10) || FEED_PAGE, FEED_PAGE), 200);
  const [{ posts, hasMore }, overview, followed] = await Promise.all([
    listFeed({ view: "recent", viewerId: user?.id, themeId: theme.id, limit }),
    themeOverview(db.query, theme.id, user?.id ?? null),
    user ? followedThemeIds(user.id) : Promise.resolve([] as string[]),
  ]);
  const [rooms, reactions, syntheses] = await Promise.all([
    linkedRooms(db.query, posts.map((p) => p.id), user?.id ?? null),
    reactionSummaries(db.query, posts.map((p) => p.id), user?.id ?? null),
    getSyntheses(db.query, posts.map((p) => p.id)),
  ]);
  const canCreate = signedIn && user?.status === "active";
  const viewer = { signedIn, canReact: Boolean(canCreate) };

  return (
    <div className="wide-page space-y-6">
      <header className="rounded-card bg-ink p-5 text-white sm:p-6">
        <Link href="/" className="text-sm font-semibold text-white/80 hover:underline">← Tous les thèmes</Link>
        <p className="mt-4 label-mono text-white/70">Thème</p>
        <h1 className="mt-1 text-3xl font-bold">{theme.name}</h1>
        {theme.description && <p className="mt-2 max-w-2xl text-white/85">{theme.description}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="text-sm text-white/85">
            <strong className="text-white">{overview.followers}</strong> membre{overview.followers > 1 ? "s" : ""} suive{overview.followers > 1 ? "nt" : ""} ce thème ·{" "}
            <strong className="text-white">{overview.postsLast30}</strong> publication{overview.postsLast30 > 1 ? "s" : ""} en 30 jours
          </p>
          <div className="rounded-card bg-white p-1">
            <FollowButton target="theme" keyValue={theme.slug} initialFollowing={followed.includes(theme.id)} signedIn={signedIn} label="ce thème" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="theme-publications" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="theme-publications" className="text-xl font-bold">Publications récentes</h2>
            {canCreate && <Link href="/publier" className="btn-secondary">Publier dans ce thème</Link>}
          </div>
          {posts.length === 0 ? (
            <p className="card p-6 text-soft">
              Rien encore dans ce thème. {canCreate ? <Link href="/publier" className="btn-link">Soyez la première personne à publier →</Link> : null}
            </p>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} rooms={rooms.get(post.id)} reactions={reactions.get(post.id)} viewer={viewer} synthesis={syntheses.get(post.id)} />
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="mt-4 text-center">
              <Link href={`/theme/${theme.slug}?n=${limit + FEED_PAGE}`} scroll={false} className="btn-secondary">Afficher plus</Link>
            </div>
          )}
        </section>

        <aside className="space-y-4" aria-label={`La communauté ${theme.name}`}>
          <section className="card p-5" aria-labelledby="theme-salons">
            <h2 id="theme-salons" className="font-bold">Salons du thème</h2>
            {overview.rooms.length ? (
              <ul className="mt-2 divide-y divide-line">
                {overview.rooms.map((r) => (
                  <li key={r.id} className="py-2">
                    <Link href={`/s/${r.id}#chat`} className="font-bold text-accent hover:underline">{r.name}</Link>
                    {r.description && <p className="text-sm text-soft">{r.description}</p>}
                    <p className="text-xs text-muted">{r.members} membre{r.members > 1 ? "s" : ""} · {r.recentMessages} message{r.recentMessages > 1 ? "s" : ""} sur 7 jours</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-soft">Aucun salon public dans ce thème.</p>
            )}
            {canCreate && <Link href="/salons/nouveau" className="btn-link mt-2 inline-block">Créer un salon →</Link>}
          </section>
          <section className="card p-5" aria-labelledby="theme-membres">
            <h2 id="theme-membres" className="font-bold">Membres actifs</h2>
            <p className="mt-1 text-xs text-muted">Publications et commentaires du thème sur 30 jours.</p>
            {overview.members.length ? (
              <ul className="mt-2 space-y-2">
                {overview.members.map((m) => (
                  <li key={m.handle} className="flex items-center gap-2">
                    <Avatar name={m.displayName} seed={m.handle} size="sm" />
                    <Link href={`/m/${m.handle}`} className="min-w-0 truncate font-semibold hover:underline">{m.displayName}</Link>
                    <span className="ml-auto shrink-0 text-xs text-muted">{m.contributions}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-soft">Personne n’a encore contribué ce mois-ci.</p>
            )}
          </section>
          {themesWithGames().has(theme.slug) && (
            <section className="card p-5" aria-labelledby="theme-quiz">
              <h2 id="theme-quiz" className="font-bold">Quiz du thème</h2>
              <p className="mt-1 text-sm text-soft">Cinq questions pour tester vos connaissances, avec une explication à chaque réponse.</p>
              <Link href={`/jeux?theme=${theme.slug}`} className="btn-link mt-2 inline-block">Jouer au quiz {theme.name} →</Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
