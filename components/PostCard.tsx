import Link from "next/link";
import type { Post } from "@/lib/data/posts";
import { displayHost } from "@/lib/urls";
import type { LinkedRoom } from "@/lib/rooms/discovery.ts";
import type { ReactionSummary } from "@/lib/social/reaction-kinds.ts";
import type { SynthesisState } from "@/lib/actus/synthesis.ts";
import { Avatar } from "./Avatar";
import { LocalTime } from "./LocalTime";
import { ReactionBar } from "./ReactionBar";
import { ShareButton } from "./ShareButton";
import { CardActions } from "./DevelopPanel";
import { PostGallery } from "./PostGallery";
import { Icon } from "./Icon";
import { RelayButton } from "./RelayButton";
import { ThemeTile } from "./ThemeTile";
import type { FollowedRelay, RelaySummary } from "@/lib/social/relays.ts";

// Carte du fil, direction « Carnet de labo » : qui (une personne avec son avatar, ou la source
// d'une actu avec la case de son thème), le titre, l'image, « En bref », puis les actions.

/** À partir de ce nombre de loupes « À creuser », la carte invite à ouvrir un salon. */
const DIG_THRESHOLD = 2;

const VERB = { news: "partage une actu", question: "pose une question", experience: "raconte une expérience" } as const;

function excerpt(text: string, max = 240) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export function PostCard({
  post,
  rooms = [],
  reactions,
  viewer,
  synthesis,
  followed,
  relay,
  relayedBy,
}: {
  post: Post;
  rooms?: LinkedRoom[];
  reactions?: ReactionSummary;
  viewer?: { signedIn: boolean; canReact: boolean };
  synthesis?: SynthesisState;
  /** Membres suivis par le lecteur qui ont réagi (preuve sociale du fil). */
  followed?: { names: string[]; total: number };
  relay?: RelaySummary;
  /** Relais le plus récent d'un membre suivi : bandeau « Relayé par X » avec son avis. */
  relayedBy?: FollowedRelay;
}) {
  const isActu = Boolean(post.sourceName);
  const isRecap = post.author.isAgent && !isActu;
  const source = post.sources[0];
  const href = `/p/${post.id}`;
  const theme = post.themes[0];
  const person = !isActu && !isRecap;

  return (
    <article className="card min-w-0 px-4 pb-3 pt-4 sm:px-[22px] sm:pb-4 sm:pt-5">
      {relayedBy && (
        <div className="-mx-4 -mt-4 mb-3.5 border-b border-hairline bg-paper px-4 py-2.5 sm:-mx-[22px] sm:-mt-5 sm:px-[22px]">
          <p className="flex items-start gap-1.5 text-[13px] leading-snug text-soft">
            <Icon id="relayer" size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent" />
            <span className="min-w-0">
              Relayé par <Link href={`/m/${relayedBy.handle}`} className="font-semibold text-ink hover:underline">{relayedBy.name}</Link>
              {relayedBy.total > 1 && <> et {relayedBy.total - 1} autre{relayedBy.total > 2 ? "s" : ""}</>}
              {relayedBy.note && <span className="mt-0.5 block italic text-body">« {relayedBy.note} »</span>}
            </span>
          </p>
        </div>
      )}
      <header className="flex items-center gap-3">
        {person ? (
          post.author.handle ? (
            <Link href={`/m/${post.author.handle}`} className="shrink-0" tabIndex={-1} aria-hidden>
              <Avatar name={post.author.displayName} seed={post.author.handle} size="md" deleted={post.author.isDeleted} imageId={post.author.avatarId} />
            </Link>
          ) : (
            <Avatar name={post.author.displayName} size="md" deleted={post.author.isDeleted} />
          )
        ) : theme ? (
          <Link href={`/theme/${theme.slug}`} title={theme.name} className="shrink-0"><ThemeTile slug={theme.slug} name={theme.name} /></Link>
        ) : (
          <Avatar name="Valyo" size="md" agent />
        )}
        <p className="min-w-0 flex-1 text-sm leading-snug text-soft">
          {person ? (
            <>
              {post.author.handle ? (
                <Link href={`/m/${post.author.handle}`} className="font-semibold text-ink hover:underline">{post.author.displayName}</Link>
              ) : (
                <strong className="font-semibold text-ink">{post.author.displayName}</strong>
              )}{" "}
              {VERB[post.kind]}
              {post.kind === "question" && post.bestCommentId && <strong className="font-semibold text-success"> · résolue ✓</strong>}
            </>
          ) : (
            <strong className="font-semibold text-ink">{isRecap ? "Récap Valyo" : post.sourceName}</strong>
          )}
          <span aria-hidden> · </span>
          <LocalTime iso={post.createdAt} />
        </p>
        {person && theme && (
          <Link href={`/theme/${theme.slug}`} title={theme.name} className="shrink-0"><ThemeTile slug={theme.slug} name={theme.name} size="sm" /></Link>
        )}
      </header>

      <h2 className="mt-3 font-display text-[19px] font-semibold leading-snug sm:text-[23px] sm:leading-tight">
        <Link href={href} className="hover:text-accent">{post.title}</Link>
      </h2>

      {post.imageUrl ? (
        <Link href={href} className="mt-3.5 block overflow-hidden rounded-lg bg-chip" tabIndex={-1} aria-hidden>
          {/* Image fournie par la source (flux ou og:image), créditée et liée à l'article d'origine. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[2/1] w-full object-cover" />
        </Link>
      ) : post.images.length ? (
        <Link href={href} className="mt-3.5 block overflow-hidden rounded-lg" tabIndex={-1} aria-hidden><PostGallery images={post.images} /></Link>
      ) : null}

      {post.body &&
        (isActu ? (
          <p className="mt-3.5 border-l-2 border-accent pl-3 text-[15px] leading-relaxed text-body">
            <span className="label-mono mr-2 text-accent">En bref</span>
            {excerpt(post.body)}
          </p>
        ) : (
          <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-body">{excerpt(post.body)}</p>
        ))}

      {/* Un seul encart social par carte : le bandeau « Relayé par » prime (audit UX, P1-2). */}
      {followed && followed.total > 0 && !relayedBy && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-soft">
          <Icon id="personnes" size={14} strokeWidth={1.8} className="shrink-0 text-accent" />
          <span className="min-w-0 truncate">
            Parmi vos abonnements, <strong className="font-semibold text-ink">{followed.names.join(" et ")}</strong>
            {followed.total > followed.names.length && <> et {followed.total - followed.names.length} autre{followed.total - followed.names.length > 1 ? "s" : ""}</>}
            {followed.total > 1 ? " ont réagi" : " a réagi"}
          </span>
        </p>
      )}

      {(reactions?.counts.a_creuser ?? 0) >= DIG_THRESHOLD && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream px-3 py-2 text-sm ring-1 ring-accent-line">
          <span className="text-soft">
            <span aria-hidden>🔎 </span>
            <strong className="font-semibold text-ink">{reactions!.counts.a_creuser} personnes</strong> veulent creuser ce sujet
          </span>
          <Link href={rooms.length ? `${href}#salons-associes` : `/salons/nouveau?post=${post.id}`} className="font-semibold text-accent hover:underline">
            {rooms.length ? "Rejoindre le salon →" : "Creuser ensemble en salon →"}
          </Link>
        </div>
      )}

      <CardActions
        postId={post.id}
        postTitle={post.title}
        commentCount={post.commentCount}
        roomCount={rooms.length}
        roomHref={rooms.length ? `${href}#salons-associes` : `/salons/nouveau?post=${post.id}`}
        canDevelopSource={Boolean(source)}
        initial={synthesis ?? { status: "none" }}
        access={{ signedIn: Boolean(viewer?.signedIn), canDevelop: Boolean(viewer?.canReact) }}
        reactions={
          reactions ? (
            <ReactionBar postId={post.id} initial={reactions} signedIn={Boolean(viewer?.signedIn)} canReact={Boolean(viewer?.canReact)} variant="inline" />
          ) : null
        }
        relay={relay ? <RelayButton postId={post.id} initial={{ count: relay.count, mine: relay.mine, myNote: relay.myNote }} signedIn={Boolean(viewer?.signedIn)} canRelay={Boolean(viewer?.canReact)} /> : null}
        share={<ShareButton path={href} title={post.title} />}
        sourceLink={
          source ? (
            <a href={source} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
              <Icon id="source" size={15} strokeWidth={1.8} />
              {isActu ? `Lire l’article sur ${post.sourceName}` : `Voir la source · ${displayHost(source)}`}
            </a>
          ) : null
        }
      />
    </article>
  );
}
