import type { Metadata } from "next";
import { ListenButton } from "@/components/ListenButton";
import { naturalVoiceEnabled } from "@/lib/lecture-audio.ts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listComments } from "@/lib/data/comments";
import { publishedRecapItems } from "@/lib/data/editorial";
import { getPost } from "@/lib/data/posts";
import { PostRooms } from "@/components/PostRooms";
import { RecapArticle } from "@/components/RecapArticle";
import { ReportButton } from "@/components/ReportButton";
import { displayHost } from "@/lib/urls";
import { KIND_LABELS } from "@/lib/validation";
import { AuthorName } from "@/components/AuthorName";
import { ShareButton } from "@/components/ShareButton";
import { RoomsPopover } from "@/components/RoomsPopover";
import { linkedRooms } from "@/lib/rooms/discovery.ts";
import { ReactionBar } from "@/components/ReactionBar";
import { reactionSummaries } from "@/lib/social/reactions.ts";
import { relaySummaries } from "@/lib/social/relays.ts";
import { RelayButton } from "@/components/RelayButton";
import { LocalTime } from "@/components/LocalTime";
import { DevelopSection } from "@/components/DevelopPanel";
import { ThemeTile } from "@/components/ThemeTile";
import { Avatar } from "@/components/Avatar";
import { MentionText } from "@/components/MentionText";
import { getSyntheses } from "@/lib/actus/synthesis.ts";
import { JsonLd, PUBLISHER, SITE_URL } from "@/components/JsonLd";
import { PostGallery } from "@/components/PostGallery";
import { PinButton } from "@/components/PinButton";
import { Comments } from "./Comments";
import { PostOwnerActions } from "./PostOwnerActions";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = await getPost((await params).id);
  if (!post || post.status !== "published") return { title: "Publication indisponible", robots: { index: false } };
  // Aperçu de lien partagé (SEO C022) : titre et image de LA publication, pas du site.
  const description = post.body.replace(/\s+/g, " ").trim().slice(0, 160) || `Une publication sur Valyo, le réseau des passionnés de tech et de sciences.`;
  const image = post.imageUrl ?? (post.images[0] ? `/media/${post.images[0].id}` : "/partage.png");
  return {
    title: post.title,
    description,
    alternates: { canonical: `/p/${post.id}` },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      url: `/p/${post.id}`,
      publishedTime: post.createdAt,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: post.title, description, images: [image] },
  };
}

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer nofollow ugc" } as const;

export default async function PostPage({ params }: { params: Params }) {
  const { id } = await params;
  const [post, user] = await Promise.all([getPost(id), getCurrentUser()]);
  if (!post) notFound();

  const isAuthor = user?.id === post.authorId;
  const pinnedId = isAuthor && user ? ((await db.query<{ pinned_post_id: string | null }>(`SELECT pinned_post_id FROM users WHERE id = $1`, [user.id]))[0]?.pinned_post_id ?? null) : null;
  if (post.status === "deleted" || post.status === "removed" || (post.status === "pending" && !isAuthor)) {
    return (
      <div className="card p-6 text-center">
        <h1 className="text-xl font-bold">Publication indisponible</h1>
        <p className="mt-2 text-soft">
          {post.status === "removed" ? "Cette publication a été retirée par la modération." : "Cette publication a été supprimée par son auteur."}
        </p>
        <Link href="/" className="btn-secondary mt-4">
          Retour au fil
        </Link>
      </div>
    );
  }

  const [comments, reactionMap, synthesisMap, relayMap] = await Promise.all([
    listComments(post.id, user?.id ?? null),
    reactionSummaries(db.query, [post.id], user?.id ?? null),
    getSyntheses(db.query, [post.id]),
    relaySummaries(db.query, [post.id], user?.id ?? null),
  ]);
  const relay = relayMap.get(post.id)!;
  const roomHref = `/salons/nouveau?post=${post.id}`;
  const roomCount = (await linkedRooms(db.query, [post.id], user?.id ?? null)).get(post.id)?.length ?? 0;
  const reactions = reactionMap.get(post.id)!;
  const viewer = user ? { id: user.id, canContribute: user.onboarded && user.status === "active" } : null;
  // Rendu structuré pour un récapitulatif publié de l'agent (ancres stables, statuts, sources par nouvelle).
  const recapItems = post.author.isAgent ? await publishedRecapItems(post.id) : null;
  // Article republié sous licence libre : l'attribution (auteur, licence, lien) suit le séparateur.
  const [mainBody, attribution] = post.sourceName ? post.body.split("\n\n———\n\n") : [post.body];

  // Données structurées (SEO) : une actu de l'agent ou importée est un article édité par
  // Valyo ; une publication de membre est un message de forum, avec son auteur et ses réponses.
  const url = `${SITE_URL}/p/${post.id}`;
  const absolute = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);
  const picture = post.imageUrl ?? (post.images[0] ? `/media/${post.images[0].id}` : null);
  const editorial = post.author.isAgent || Boolean(post.sourceName);
  const structured: Record<string, unknown>[] = post.status !== "published" ? [] : [
    {
      "@context": "https://schema.org",
      "@type": editorial ? "Article" : "DiscussionForumPosting",
      headline: post.title.slice(0, 110),
      text: mainBody.replace(/\s+/g, " ").trim().slice(0, 5000),
      url,
      mainEntityOfPage: url,
      datePublished: post.createdAt,
      dateModified: post.editedAt ?? post.createdAt,
      ...(picture ? { image: absolute(picture) } : {}),
      ...(post.themes.length ? { articleSection: post.themes.map((t) => t.name) } : {}),
      // Article republié : l'auteur est la source d'origine (NASA…), Valyo n'est que l'éditeur.
      author: post.sourceName ? { "@type": "Organization", name: post.sourceName }
        : editorial || !post.author.handle ? PUBLISHER
        : { "@type": "Person", name: post.author.displayName, url: `${SITE_URL}/m/${post.author.handle}` },
      publisher: PUBLISHER,
      commentCount: post.commentCount,
      interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: post.commentCount },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Valyo", item: SITE_URL },
        ...(post.themes[0] ? [{ name: post.themes[0].name, item: `${SITE_URL}/theme/${post.themes[0].slug}` }] : []),
        { name: post.title, item: url },
      ].map((entry, i) => ({ "@type": "ListItem", position: i + 1, ...entry })),
    },
  ];

  return (
    <div className="wide-page space-y-4">
      {structured.length > 0 && <JsonLd data={structured} />}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_17.5rem] xl:gap-8">
      {/* Même colonne que le fil : le contenu ne change pas de place d'une page à l'autre. */}
      <div className="mx-auto w-full min-w-0 max-w-[760px] space-y-4 2xl:max-w-[840px]">
      <Link href="/" className="btn-link">← Fil</Link>
      <article className="card p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-soft">
          {post.sourceName ? (
            <>
              {post.themes[0] && <Link href={`/theme/${post.themes[0].slug}`} title={post.themes[0].name}><ThemeTile slug={post.themes[0].slug} name={post.themes[0].name} /></Link>}
              <strong className="font-semibold text-ink">{post.sourceName}</strong>
            </>
          ) : (
            <>
              {post.author.handle && <Link href={`/m/${post.author.handle}`} tabIndex={-1} aria-hidden><Avatar name={post.author.displayName} seed={post.author.handle} size="md" agent={post.author.isAgent} imageId={post.author.avatarId} /></Link>}
              <AuthorName author={post.author} avatar={false} />
              <span className="chip">{KIND_LABELS[post.kind]}</span>
              {post.kind === "question" && post.bestCommentId && (
                <a href="#commentaires" className="chip bg-success-soft font-semibold text-success ring-1 ring-success-line">✓ Résolue</a>
              )}
            </>
          )}
          <span aria-hidden className="hidden sm:inline">·</span>
          <span className="basis-full sm:basis-auto"><LocalTime iso={post.createdAt} mode="full" /></span>
          {post.editedAt && (
            <span className="italic">
              (<LocalTime iso={post.editedAt} prefix="Modifié le " mode="full" />)
            </span>
          )}
        </div>
        <h1 className="text-[23px] font-bold leading-tight sm:text-3xl">{post.title}</h1>
        {!recapItems?.length && mainBody.trim().length > 80 && (
          <div className="mt-3"><ListenButton label="Écouter l’article" text={`${post.title}. ${mainBody}`} src={naturalVoiceEnabled() && post.sourceName ? `/api/posts/${post.id}/lecture?type=article` : undefined} /></div>
        )}
        {post.imageUrl && (
          <div className="-mx-5 mt-4 aspect-[2/1] overflow-hidden bg-chip sm:-mx-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          </div>
        )}
        {post.images.length > 0 && (
          <div className="mt-4">
            <PostGallery images={post.images} full />
          </div>
        )}
        {recapItems && recapItems.length > 0 ? (
          <RecapArticle items={recapItems} />
        ) : (
          <>
            <div className="mt-4 whitespace-pre-wrap text-[16px] leading-relaxed">{post.sourceName ? mainBody : <MentionText text={mainBody} />}</div>
            {attribution && <p className="mt-5 whitespace-pre-wrap border-t border-line pt-3 text-xs leading-relaxed text-muted">{attribution}</p>}
          </>
        )}
        {post.sources[0] && (
          <div className="mt-4">
            <DevelopSection
              postId={post.id}
              naturalVoice={naturalVoiceEnabled()}
              initial={synthesisMap.get(post.id) ?? { status: "none" }}
              access={{ signedIn: Boolean(user?.onboarded), canDevelop: Boolean(viewer?.canContribute) }}
              roomHref={roomHref}
              sourceLink={
                <a href={post.sources[0]} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
                  {post.sourceName ? `Lire l’article sur ${post.sourceName}` : `Voir la source · ${displayHost(post.sources[0])}`}
                </a>
              }
            />
          </div>
        )}

        {post.themes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.themes.map((t) => (
              <Link key={t.slug} href={`/theme/${t.slug}`} className="chip hover:bg-line">
                {t.name}
              </Link>
            ))}
          </div>
        )}

        {/* Une seule source : déjà proposée à côté du bouton de synthèse ; la liste ne sert qu'à partir de deux. */}
        {post.sources.length > 1 && (
          <section className="mt-5 border-t border-line pt-4">
            <h2 className="label-mono text-soft">Sources</h2>
            <ul className="mt-2 space-y-1">
              {post.sources.map((source) => (
                <li key={source}>
                  <a href={source} {...EXTERNAL} className="btn-link">
                    {displayHost(source)}
                  </a>
                  <span className="ml-2 break-all text-sm text-muted">{source}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {post.demoUrl && (
          <section className="mt-5 rounded-card bg-accent-soft p-4">
            <a href={post.demoUrl} {...EXTERNAL} className="btn-primary">
              Tester ↗
            </a>
            <p className="mt-2 text-sm text-soft">
              Ouvre un service externe ({displayHost(post.demoUrl)}), non géré par Valyo. Ses conditions d’accès et son éventuel coût ne sont pas vérifiés.
            </p>
          </section>
        )}


        <div className="mt-5 flex flex-wrap items-center gap-0.5 border-t border-hairline pt-2">
          <ReactionBar postId={post.id} initial={reactions} signedIn={Boolean(user?.onboarded)} canReact={Boolean(viewer?.canContribute)} variant="inline" />
          <RoomsPopover postId={post.id} postTitle={post.title} roomCount={roomCount} signedIn={Boolean(user?.onboarded)} canCreate={Boolean(viewer?.canContribute)} />
          <RelayButton postId={post.id} initial={{ count: relay.count, mine: relay.mine, myNote: relay.myNote }} signedIn={Boolean(user?.onboarded)} canRelay={Boolean(viewer?.canContribute)} />
          <ShareButton path={`/p/${post.id}`} title={post.title} />
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 pl-2">
            {isAuthor && post.status === "published" && <PinButton postId={post.id} pinned={pinnedId === post.id} compact />}
            {isAuthor && <PostOwnerActions postId={post.id} subtle />}
            {viewer?.canContribute && !isAuthor && <ReportButton targetKind="post" targetId={post.id} label="Signaler" subtle />}
          </span>
        </div>
      </article>

      <section id="commentaires" aria-labelledby="commentaires-titre">
        <h2 id="commentaires-titre" className="mb-3 text-lg font-bold">
          Commentaires <span className="font-mono text-sm font-normal text-muted">{post.commentCount}</span>
        </h2>
        <Comments
          postId={post.id}
          comments={comments}
          viewer={viewer}
          question={post.kind === "question" ? { postAuthorId: post.authorId, bestCommentId: post.bestCommentId } : null}
        />
      </section>
      </div>
      <aside className="min-w-0" aria-label="Discussions associées">
        <PostRooms postId={post.id} viewerId={user?.id ?? null} canCreate={Boolean(viewer?.canContribute)} />
      </aside>
      </div>
    </div>
  );
}
