import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { FEED_PAGE, listFeed } from "@/lib/data/posts";
import { followedThemeIds, listActiveThemes } from "@/lib/data/themes";
import { FollowButton } from "@/components/FollowButton";
import { db } from "@/lib/db";
import { communityRooms, linkedRooms } from "@/lib/rooms/discovery.ts";
import { newcomerProgress, newcomersToWelcome, suggestedMembers } from "@/lib/social/suggestions.ts";
import { followedReactions, reactionSummaries, type FollowedReactions } from "@/lib/social/reactions.ts";
import { followedRelays, relaySummaries, type FollowedRelay } from "@/lib/social/relays.ts";
import { maybeImportActus } from "@/lib/actus/import.ts";
import { createClaudeSummarizer, estimatedCostMicros } from "@/lib/actus/claude-summarizer.ts";
import { createHttpTransport } from "@/lib/editorial/fetch.ts";
import { CommunitySidebar } from "@/components/CommunitySidebar";
import { PostCard } from "@/components/PostCard";
import { trendingPosts } from "@/lib/social/trending.ts";
import { ThemeNav } from "@/components/ThemeNav";
import { QuickComposer } from "@/components/QuickComposer";
import { Avatar } from "@/components/Avatar";
import { getSyntheses } from "@/lib/actus/synthesis.ts";
import { JsonLd, PUBLISHER, SITE_URL } from "@/components/JsonLd";

type SearchParams = Promise<{ vue?: string; theme?: string; n?: string }>;

// Les variantes ?vue/?theme/?n sont des vues du même fil : une seule adresse canonique.
export const metadata = { alternates: { canonical: "/" } };

function feedHref(params: { vue: string; theme?: string | null; n?: number }) {
  const search = new URLSearchParams();
  search.set("vue", params.vue);
  if (params.theme) search.set("theme", params.theme);
  if (params.n && params.n > FEED_PAGE) search.set("n", String(params.n));
  return `/?${search.toString()}`;
}

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Actus réelles : importation en arrière-plan, au plus une fois par heure, sans attendre.
  // Chaque nouvel article reçoit sa synthèse IA (Haiku) ; VALYO_SYNTHESE_AUTO=0 pour couper.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const summarize = apiKey && process.env.VALYO_SYNTHESE_AUTO !== "0" ? createClaudeSummarizer({ apiKey, model: process.env.VALYO_SYNTHESE_MODELE }) : null;
  void maybeImportActus({ db, transport: createHttpTransport(), summarize, estimateMicros: estimatedCostMicros(process.env.VALYO_SYNTHESE_MODELE) }).catch(() => {});
  const [user, themes] = await Promise.all([getCurrentUser(), listActiveThemes()]);
  const signedIn = Boolean(user?.onboarded);
  const view = params.vue === "recentes" ? "recent" : params.vue === "pour-vous" ? "foryou" : signedIn ? "foryou" : "recent";
  const vue = view === "recent" ? "recentes" : "pour-vous";
  // Le fil se charge par tranches ; le nombre affiché vit dans l'URL pour que
  // le retour depuis une publication retrouve la même liste et la même position.
  const limit = Math.min(Math.max(Number.parseInt(params.n ?? "", 10) || FEED_PAGE, FEED_PAGE), 200);

  const theme = params.theme ? themes.find((t) => t.slug === params.theme) ?? null : null;

  // Lectures indépendantes en parallèle : un seul aller-retour d'attente vers la base.
  const t0 = performance.now();
  const [{ posts, hasMore }, myThemeIds, community, newcomer, trending, people] = await Promise.all([
    // Un thème choisi dans les cases s'affiche en entier, même s'il ne fait pas partie de « mes thèmes ».
    listFeed({ view: theme ? "recent" : view, viewerId: user?.id, themeId: theme?.id, limit }),
    user ? followedThemeIds(user.id) : Promise.resolve([] as string[]),
    communityRooms(db.query, user?.onboarded && user.status === "active" ? user.id : null),
    user?.onboarded && user.status === "active" ? newcomerProgress(db.query, user.id) : Promise.resolve(null),
    trendingPosts(db.query),
    signedIn && user ? suggestedMembers(db.query, user.id, 4) : Promise.resolve([]),
  ]);
  const newcomers = signedIn && user?.status === "active" && !newcomer ? await newcomersToWelcome(db.query, user.id) : [];
  const t1 = performance.now();
  const postIds = posts.map((p) => p.id);
  const [rooms, reactions, syntheses, followedReacts, relays, relayedBy] = await Promise.all([
    linkedRooms(db.query, postIds, user?.id ?? null),
    reactionSummaries(db.query, postIds, user?.id ?? null),
    getSyntheses(db.query, postIds),
    signedIn && user ? followedReactions(db.query, postIds, user.id) : Promise.resolve(new Map<string, FollowedReactions>()),
    relaySummaries(db.query, postIds, user?.id ?? null),
    signedIn && user ? followedRelays(db.query, postIds, user.id) : Promise.resolve(new Map<string, FollowedRelay>()),
  ]);
  // Ventilation du temps du fil (audit performance) : visible dans les journaux Railway.
  if (process.env.VALYO_TIMING) {
    console.log(`[fil] données en ${Math.round(performance.now() - t0)} ms (vague 1 : ${Math.round(t1 - t0)} ms, vague 2 : ${Math.round(performance.now() - t1)} ms, ${posts.length} publications, ${signedIn ? "membre" : "visiteur"})`);
  }
  const following = theme ? myThemeIds.includes(theme.id) : false;
  // Mes thèmes d'abord dans les cases, puis les autres.
  const myThemes = themes.filter((t) => myThemeIds.includes(t.id));
  const orderedThemes = [...myThemes, ...themes.filter((t) => !myThemeIds.includes(t.id))];

  const viewer = { signedIn, canReact: Boolean(signedIn && user?.status === "active") };

  return (
    <div className="wide-page">
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
      <div className="mx-auto w-full min-w-0 max-w-[760px] space-y-[18px] 2xl:max-w-[840px]">
      <h1 className="sr-only">Valyo — l’actualité tech et sciences, et la communauté des Valyors</h1>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Valyo",
        url: SITE_URL,
        inLanguage: "fr",
        description: "Valyo est un réseau social consacré à l’IA, à l’espace, aux sciences et à la technologie. Ses membres, les Valyors, y suivent l’actualité sourcée et en discutent.",
        publisher: PUBLISHER,
      }} />

      {/* La définition du site, visible de tous dès l'ouverture (les visiteurs ont en plus l'encart ci-dessous). */}
      {signedIn && (
        <p className="text-sm text-soft">
          <strong className="font-semibold text-ink">Valyo</strong>, le réseau social des passionnés d’IA, d’espace, de sciences et de
          technologie. Ici, les membres s’appellent les <strong className="font-semibold text-ink">Valyors</strong>.
        </p>
      )}

      <ThemeNav
        allHref={feedHref({ vue })}
        current={theme?.slug ?? null}
        mineCount={myThemes.length}
        tiles={orderedThemes.map((t) => ({ slug: t.slug, name: t.name, href: feedHref({ vue, theme: t.slug }), mine: myThemeIds.includes(t.id) }))}
      />

      {signedIn ? (
        <QuickComposer
          user={{ name: user!.displayName ?? user!.handle ?? "?", handle: user!.handle, avatarId: user!.avatarId }}
          themes={themes.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
          myThemeIds={myThemeIds}
        />
      ) : (
        <section className="rounded-[10px] bg-ink p-5 text-white sm:p-6">
          <p className="label-mono text-[#B9C1CB]">Le réseau des curieux</p>
          <h2 className="mt-1.5 text-xl font-semibold sm:text-2xl">Les nouvelles tech et sciences, et ceux qui en parlent.</h2>
          <p className="mt-2 text-sm text-[#C9CED6]">
            Valyo est un réseau social consacré à l’IA, à l’espace, aux sciences et à la technologie : on y suit l’actualité sourcée, on la
            commente et on en discute en salon. Ses membres s’appellent les <strong className="font-semibold text-white">Valyors</strong>.
          </p>
          <Link href="/connexion" className="mt-4 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-[#9A3412]">Rejoindre Valyo</Link>
        </section>
      )}

      {newcomer && (
        <Link href="/bienvenue/premiers-pas" className="card flex items-center justify-between gap-3 px-4 py-3 hover:ring-accent">
          <span className="min-w-0">
            <span className="label-mono block text-accent">Première semaine · {newcomer.done}/3</span>
            <span className="block text-sm text-soft">Une question à laquelle répondre, un salon, des membres à suivre.</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-accent">Continuer →</span>
        </Link>
      )}

      <nav aria-label="Tri du fil" className="flex items-center gap-1 text-sm">
        {(
          [
            ["pour-vous", "Pour vous"],
            ["recentes", "Les plus récentes"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            aria-current={vue === key ? "page" : undefined}
            href={feedHref({ vue: key, theme: theme?.slug })}
            className={`rounded-md px-3 py-1.5 ${vue === key ? "bg-white font-semibold text-ink ring-1 ring-line" : "text-soft hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {signedIn && !theme && vue === "pour-vous" && (
        <p className="-mt-2 text-sm text-soft">
          {myThemes.length ? (
            <>Vos thèmes : <strong className="font-semibold text-ink">{myThemes.map((t) => t.name).join(" · ")}</strong>, et les membres que vous suivez. </>
          ) : (
            <>Vous ne suivez encore aucun thème : ce fil montre tout. </>
          )}
          <Link href="/parametres#profil-titre" className="font-semibold text-accent hover:underline">{myThemes.length ? "Modifier mes thèmes" : "Choisir mes thèmes"}</Link>
        </p>
      )}

      {params.theme && !theme && (
        <p role="alert" className="card p-4">
          Ce thème n’existe pas ou n’est plus actif. Le fil affiche tous les thèmes.
        </p>
      )}

      {theme && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-lg font-bold">{theme.name}</h2>
            <p className="text-sm text-neutral-600">{theme.description}</p>
          </div>
          <FollowButton target="theme" keyValue={theme.slug} initialFollowing={following} signedIn={signedIn} label="ce thème" />
        </section>
      )}

      {posts.length === 0 && signedIn && !theme && vue === "pour-vous" && myThemes.length > 0 ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Rien de nouveau dans vos thèmes pour l’instant.</p>
          <p className="mt-1 text-muted">Les autres sujets sont dans « Les plus récentes ».</p>
          <Link href={feedHref({ vue: "recentes" })} className="btn-primary mt-4">Voir les plus récentes</Link>
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Les premières actus arrivent{theme ? " dans ce thème" : ""}…</p>
          <p className="mt-1 text-neutral-600">Rechargez dans un instant, ou lancez la discussion vous-même.</p>
          <Link href={signedIn ? "/publier" : "/connexion?next=/publier"} className="btn-primary mt-4">
            Publier
          </Link>
        </div>
      ) : (
        <ul id="fil-liste" className="space-y-[18px] transition-opacity duration-150">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} rooms={rooms.get(post.id)} reactions={reactions.get(post.id)} viewer={viewer} synthesis={syntheses.get(post.id)} followed={followedReacts.get(post.id)} relay={relays.get(post.id)} relayedBy={relayedBy.get(post.id)} />
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="text-center">
          <Link href={feedHref({ vue, theme: theme?.slug, n: limit + FEED_PAGE })} scroll={false} className="btn-secondary">
            Afficher plus
          </Link>
        </div>
      )}
      </div>
      <div className="space-y-4">
        {trending.length > 0 && (
          <section className="card px-5 py-[18px]" aria-labelledby="tendances">
            <h2 id="tendances" className="label-mono">Tendances · 72 h</h2>
            <ol className="mt-3.5 space-y-3.5">
              {trending.map((t, i) => (
                <li key={t.id} className="flex gap-3">
                  <span className="shrink-0 whitespace-nowrap pt-0.5 font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <Link href={`/p/${t.id}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-accent">{t.title}</Link>
                    <span className="text-xs text-muted">{t.theme ? `${t.theme} · ` : ""}{t.comments} commentaire{t.comments > 1 ? "s" : ""}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {people.length > 0 && (
          <section className="card px-5 py-[18px]" aria-labelledby="a-suivre">
            <h2 id="a-suivre" className="label-mono">Personnes à suivre</h2>
            <ul className="mt-3 space-y-3">
              {people.map((p) => (
                <li key={p.handle} className="flex items-center gap-2.5">
                  <Link href={`/m/${p.handle}`} className="shrink-0" tabIndex={-1} aria-hidden><Avatar name={p.displayName} seed={p.handle} size="sm" imageId={p.avatarId} /></Link>
                  <span className="min-w-0 flex-1">
                    <Link href={`/m/${p.handle}`} className="block truncate text-sm font-semibold hover:text-accent">{p.displayName}</Link>
                    <span className="block truncate text-xs text-muted">{p.sharedThemes.length ? `Aime aussi : ${p.sharedThemes.slice(0, 2).join(", ")}` : `@${p.handle}`}</span>
                  </span>
                  <FollowButton target="member" keyValue={p.handle} initialFollowing={false} signedIn label="" />
                </li>
              ))}
            </ul>
            {user?.handle && <Link href={`/m/${user.handle}/abonnements`} className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">Mes abonnements →</Link>}
          </section>
        )}
        {newcomers.length > 0 && (
          <section className="card px-5 py-[18px]" aria-labelledby="a-accueillir">
            <h2 id="a-accueillir" className="label-mono">Souhaitez la bienvenue</h2>
            <p className="mt-1 text-xs text-muted">Un premier échange décide souvent si un nouveau membre reste.</p>
            <ul className="mt-3 space-y-3">
              {newcomers.map((p) => (
                <li key={p.handle} className="flex items-center gap-2.5">
                  <Link href={`/m/${p.handle}`} className="shrink-0" tabIndex={-1} aria-hidden><Avatar name={p.displayName} seed={p.handle} size="sm" imageId={p.avatarId} /></Link>
                  <span className="min-w-0 flex-1">
                    <Link href={`/m/${p.handle}`} className="block truncate text-sm font-semibold hover:text-accent">{p.displayName}</Link>
                    <span className="block truncate text-xs text-muted">
                      {p.sharedThemes.length ? `Aime aussi : ${p.sharedThemes.slice(0, 2).join(", ")}` : p.headline || "Vient d’arriver"}
                    </span>
                  </span>
                  <Link href={`/messages/${p.handle}`} className="shrink-0 text-xs font-semibold text-accent hover:underline">Dire bonjour</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <CommunitySidebar {...community} signedIn={signedIn} />
      </div>
      </div>
    </div>
  );
}
