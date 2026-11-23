import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isFollowingMember, getMemberByHandle } from "@/lib/data/members";
import { FEED_PAGE, getPost, listFeed } from "@/lib/data/posts";
import { isBlocking } from "@/lib/social/blocks.ts";
import { activityCalendar, bestContributions, profileInsights, publicActivity, ACTIVITY_WEEKS } from "@/lib/social/profile.ts";
import { canMessage } from "@/lib/social/messages.ts";
import { computeProgress, levelName } from "@/lib/social/progress.ts";
import { reactionSummaries } from "@/lib/social/reactions.ts";
import { linkLabel } from "@/lib/profile-links";
import { Avatar } from "@/components/Avatar";
import { BlockButton } from "@/components/BlockButton";
import { FollowButton } from "@/components/FollowButton";
import { ReportButton } from "@/components/ReportButton";
import { LocalTime } from "@/components/LocalTime";
import { PostCard } from "@/components/PostCard";
import { ThemeTile } from "@/components/ThemeTile";
import { ActivityCalendar } from "@/components/ActivityCalendar";
import { PinButton } from "@/components/PinButton";

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const member = await getMemberByHandle((await params).handle);
  if (!member) return { title: "Profil introuvable", robots: { index: false } };
  const title = `${member.displayName} (@${member.handle})`;
  const description = member.headline || member.bio.replace(/\s+/g, " ").slice(0, 160) || `${member.displayName} sur Valyo, le réseau des passionnés de tech et de sciences.`;
  return {
    title,
    description,
    alternates: { canonical: `/m/${member.handle}` },
    openGraph: { title, description, url: `/m/${member.handle}`, ...(member.avatarId ? { images: [`/media/${member.avatarId}`] } : {}) },
  };
}

const ROLE_LABEL: Record<string, string> = { owner: "Propriétaire", moderator: "Modération" };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export default async function ProfilePage({ params, searchParams }: { params: Params; searchParams: Promise<{ n?: string }> }) {
  const { handle } = await params;
  const [member, user] = await Promise.all([getMemberByHandle(handle), getCurrentUser()]);
  if (!member) notFound();
  const isSelf = user?.id === member.id;
  const progressPromise = computeProgress(db.query, member.id);
  const limit = Math.min(Math.max(Number.parseInt((await searchParams).n ?? "", 10) || FEED_PAGE, FEED_PAGE), 200);
  const [following, blocked, { posts: allPosts, hasMore }, activity, messageable, insights, best, calendar, pinnedRaw] = await Promise.all([
    user && !isSelf ? isFollowingMember(user.id, member.id) : Promise.resolve(false),
    user && !isSelf ? isBlocking(db.query, user.id, member.id) : Promise.resolve(false),
    listFeed({ view: "recent", authorId: member.id, limit }),
    publicActivity(db.query, member.id),
    user?.onboarded && !isSelf ? canMessage(db.query, user.id, member.id) : Promise.resolve(false),
    profileInsights(db.query, member.id, user?.onboarded ? user.id : null),
    bestContributions(db.query, member.id, member.pinnedPostId),
    activityCalendar(db.query, member.id),
    member.pinnedPostId ? getPost(member.pinnedPostId) : Promise.resolve(null),
  ]);
  const progress = await progressPromise;
  const discovered = progress.themes.filter((t) => t.level > 0).length;
  // Sur le profil d'un autre : seulement ses découvertes ; sur le sien : toutes, avec la progression.
  const badges = isSelf ? progress.badges : progress.badges.filter((b) => b.unlocked);
  const pinned = pinnedRaw && pinnedRaw.status === "published" && pinnedRaw.authorId === member.id ? pinnedRaw : null;
  const posts = pinned ? allPosts.filter((p) => p.id !== pinned.id) : allPosts;
  const reactions = await reactionSummaries(db.query, [...posts.map((p) => p.id), ...(pinned ? [pinned.id] : [])], user?.id ?? null);
  const viewer = { signedIn: Boolean(user?.onboarded), canReact: Boolean(user?.onboarded && user.status === "active") };
  const emptySelf = isSelf && !member.headline && !member.specialties.length && !member.links.length;

  const Stat = ({ value, label, href, strong = false }: { value: number; label: string; href?: string; strong?: boolean }) => {
    const inner = (
      <>
        <p className={`font-display text-xl font-bold ${strong ? "text-accent" : ""}`}>{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
      </>
    );
    return href ? (
      <Link href={href} className="block min-w-0 rounded-lg bg-paper px-3 py-2.5 ring-1 ring-line hover:ring-accent">{inner}</Link>
    ) : (
      <div className="min-w-0 rounded-lg bg-paper px-3 py-2.5 ring-1 ring-line">{inner}</div>
    );
  };

  return (
    <div className="wide-page space-y-6">
      <section className="card overflow-hidden">
        {member.bannerId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${member.bannerId}`} alt="" className="aspect-[3/1] max-h-44 w-full object-cover sm:aspect-[5/1]" />
        ) : (
          <div aria-hidden className="h-24 bg-accent-soft bg-[linear-gradient(rgb(var(--c-accent-line))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--c-accent-line))_1px,transparent_1px)] bg-[size:16px_16px] sm:h-32" />
        )}
        <div className="px-5 pb-5 sm:px-7">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="rounded-full bg-white p-1 ring-1 ring-line">
              <Avatar name={member.displayName} seed={member.handle} size="xl" agent={member.isAgent} imageId={member.avatarId} />
            </div>
            {isSelf ? (
              <Link href="/parametres#profil-titre" className="btn-secondary">Modifier mon profil</Link>
            ) : (
              <span className="flex flex-col items-end gap-1.5">
                <span className="flex items-center gap-2">
                  {messageable && <Link href={`/messages/${member.handle}`} className="btn-secondary">Message</Link>}
                  <FollowButton target="member" keyValue={member.handle} initialFollowing={following} signedIn={Boolean(user?.onboarded)} label="" />
                </span>
                {user?.onboarded && !member.isAgent && (
                  <span className="flex gap-3">
                    <BlockButton userId={member.id} initialBlocked={blocked} />
                    <ReportButton targetKind="member" targetId={member.id} />
                  </span>
                )}
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-[28px] font-bold leading-tight">{member.displayName}</h1>
          <p className="text-soft">
            <span className="font-mono text-sm text-muted">@{member.handle}</span>
            {member.headline && <> · <span className="font-medium text-ink">{member.headline}</span></>}
          </p>
          {member.isAgent && <span className="chip mt-2 bg-accent-soft text-accent">Agent éditorial — contenus automatisés</span>}

          {member.specialties.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Spécialités">
              {member.specialties.map((s) => (
                <li key={s} className="rounded-md bg-ink px-2 py-1 font-mono text-[11px] text-white">{s}</li>
              ))}
            </ul>
          )}

          {member.bio ? (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap leading-relaxed">{member.bio}</p>
          ) : null}

          {member.links.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Liens">
              {member.links.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer nofollow me" className="font-semibold text-accent hover:underline">{linkLabel(url)} ↗</a>
                </li>
              ))}
            </ul>
          )}

          {emptySelf && (
            <p className="mt-4 rounded-lg bg-accent-soft p-3 text-sm text-ink">
              Complétez votre carte de visite : métier, spécialités, liens (GitHub, ORCID, blog…), ce sur quoi on peut vous interroger.{" "}
              <Link href="/parametres#profil-titre" className="font-semibold text-accent hover:underline">Compléter mon profil →</Link>
            </p>
          )}

          {!isSelf && (insights.followedByCount > 0 || insights.commonThemes.length > 0) && (
            <div className="mt-4 space-y-1.5 text-sm text-soft">
              {insights.followedByCount > 0 && (
                <p className="flex items-center gap-2">
                  <span className="flex -space-x-2">
                    {insights.followedBy.map((p) => (
                      <span key={p.handle} className="rounded-full ring-2 ring-white"><Avatar name={p.displayName} seed={p.handle} size="xs" imageId={p.avatarId} /></span>
                    ))}
                  </span>
                  <span>
                    Suivi·e par{" "}
                    {insights.followedBy.map((p, i) => (
                      <span key={p.handle}>
                        {i > 0 && (i === insights.followedBy.length - 1 && insights.followedByCount === insights.followedBy.length ? " et " : ", ")}
                        <Link href={`/m/${p.handle}`} className="font-semibold text-ink hover:underline">{p.displayName}</Link>
                      </span>
                    ))}
                    {insights.followedByCount > insights.followedBy.length && <> et {plural(insights.followedByCount - insights.followedBy.length, "autre")}</>}
                    {" "}que vous suivez
                  </span>
                </p>
              )}
              {insights.commonThemes.length > 0 && (
                <p>En commun avec vous : <span className="font-semibold text-ink">{insights.commonThemes.join(" · ")}</span></p>
              )}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat value={insights.taught} label="a fait apprendre" strong />
            <Stat value={insights.answers} label={insights.answers > 1 ? "réponses données" : "réponse donnée"} />
            <Stat value={activity.posts} label={activity.posts > 1 ? "publications" : "publication"} />
            <Stat value={activity.comments} label={activity.comments > 1 ? "commentaires" : "commentaire"} />
            <Stat value={member.followers} label={member.followers > 1 ? "abonnés" : "abonné"} href={`/m/${member.handle}/abonnes`} />
            <Stat value={member.following} label={member.following > 1 ? "abonnements" : "abonnement"} href={`/m/${member.handle}/abonnements`} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Membre depuis <LocalTime iso={member.createdAt} mode="full" />
            {insights.interesting > 0 && <> · ses publications ont intéressé {plural(insights.interesting, "fois", "fois")}</>}
          </p>
        </div>
      </section>

      <section id="progression" aria-labelledby="progression-titre" className="card scroll-mt-20 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="progression-titre" className="label-mono">
            Tableau périodique · <span className="text-ink">{discovered}/{progress.themes.length} éléments</span>
          </h2>
          <p className="text-sm text-soft">
            {progress.streak.current > 0 ? (
              <>Série : <strong className="font-display text-accent">{plural(progress.streak.current, "semaine")}</strong> d’affilée{progress.streak.best > progress.streak.current && <> · record {plural(progress.streak.best, "semaine")}</>}</>
            ) : progress.streak.best > 0 ? (
              <>Record : {plural(progress.streak.best, "semaine")} d’affilée</>
            ) : isSelf ? "Participez cette semaine pour lancer votre série." : null}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted">
          Un élément se découvre à la première contribution dans un thème, puis monte de niveau (Curieux, Initié, Référent) selon ce que les autres membres en retirent : réactions, réponses, discussions.
        </p>
        <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 lg:grid-cols-11">
          {progress.themes.map((t) => {
            const label = t.level ? `${t.name} : ${levelName(t.level)}, ${plural(t.points, "point")} de reconnaissance` : `${t.name} : non découvert`;
            return (
              <li key={t.slug} className="flex flex-col items-center gap-1.5">
                <Link href={`/theme/${t.slug}`} title={label} className="block rounded hover:ring-2 hover:ring-accent">
                  <ThemeTile slug={t.slug} name={t.name} size="lg" active={t.level === 3} off={t.level === 0} />
                  <span className="sr-only">{label}</span>
                </Link>
                <span aria-hidden className="flex gap-0.5">
                  {[1, 2, 3].map((l) => <span key={l} className={`h-1 w-3.5 rounded-full ${t.level >= l ? "bg-accent" : "bg-line"}`} />)}
                </span>
                <span className={`text-[10px] leading-none ${t.level ? "font-semibold text-ink" : "text-muted"}`}>{t.level ? levelName(t.level) : "—"}</span>
                {isSelf && t.toNext !== null && <span className="text-center text-[10px] leading-tight text-muted">+{t.toNext} pt{t.toNext > 1 ? "s" : ""}</span>}
              </li>
            );
          })}
        </ul>
        {member.themes.length > 0 && <p className="mt-3 text-xs text-muted">Suit : {member.themes.map((t) => t.name).join(" · ")}</p>}

        {(isSelf || badges.length > 0) && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="label-mono">Découvertes · <span className="text-ink">{progress.badges.filter((b) => b.unlocked).length}/{progress.badges.length}</span></h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {badges.map((b) => (
                <li key={b.key} className={`flex items-center gap-3 rounded-lg p-2.5 ring-1 ${b.unlocked ? "bg-accent-soft ring-accent-line" : "bg-paper ring-line"}`}>
                  <span aria-hidden className={`flex h-11 w-11 shrink-0 flex-col justify-between rounded p-1 ${b.unlocked ? "bg-accent text-white" : "border border-dashed border-line-strong bg-white text-muted"}`}>
                    <span className="font-mono text-[8px] leading-none">{b.unlocked ? "★" : "?"}</span>
                    <span className="font-display text-base font-bold leading-none">{b.symbol}</span>
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold leading-tight ${b.unlocked ? "text-ink" : "text-soft"}`}>{b.name}</span>
                    <span className="block text-[11px] leading-snug text-muted">{b.how}</span>
                    {!b.unlocked && (
                      <span className="mt-1 flex items-center gap-1.5">
                        <span className="h-1 w-16 overflow-hidden rounded-full bg-line"><span className="block h-full bg-accent" style={{ width: `${Math.min(100, (b.value / b.target) * 100)}%` }} /></span>
                        <span className="font-mono text-[10px] text-muted">{Math.min(b.value, b.target)}/{b.target}</span>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {(member.askMe || member.lookingFor) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {member.askMe && (
            <section className="card p-5">
              <h2 className="label-mono text-accent">Demandez-moi à propos de</h2>
              <p className="mt-2 leading-relaxed">{member.askMe}</p>
              {messageable && <Link href={`/messages/${member.handle}`} className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">Lui écrire →</Link>}
            </section>
          )}
          {member.lookingFor && (
            <section className="card p-5">
              <h2 className="label-mono text-accent">Je cherche</h2>
              <p className="mt-2 leading-relaxed">{member.lookingFor}</p>
              {messageable && <Link href={`/messages/${member.handle}`} className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">Proposer mon aide →</Link>}
            </section>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="publications-titre" className="min-w-0 space-y-6">
          {pinned && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="label-mono flex items-center gap-1.5 text-accent">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z" /></svg>
                  Épinglé
                </h2>
                {isSelf && <PinButton postId={pinned.id} pinned compact />}
              </div>
              <PostCard post={pinned} reactions={reactions.get(pinned.id)} viewer={viewer} />
            </div>
          )}

          {/* Audit UX (P2-5) : avec 1-2 contributions, la section répéterait la liste juste dessous. */}
          {best.posts.length + best.comments.length >= 3 && (
            <section aria-labelledby="meilleur-titre" className="card p-5">
              <h2 id="meilleur-titre" className="label-mono">Le meilleur de {member.displayName}</h2>
              <ol className="mt-3 space-y-3">
                {best.posts.map((p) => (
                  <li key={p.id} className="flex gap-3">
                    <span aria-hidden className="pt-0.5 font-mono text-xs text-accent">▲</span>
                    <span className="min-w-0">
                      <Link href={`/p/${p.id}`} className="font-semibold leading-snug hover:text-accent">{p.title}</Link>
                      <span className="block text-xs text-muted">{plural(p.reactions, "réaction")} · {plural(p.comments, "commentaire")}</span>
                    </span>
                  </li>
                ))}
                {best.comments.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <span aria-hidden className="pt-0.5 font-mono text-xs text-accent">“</span>
                    <span className="min-w-0">
                      <Link href={`/p/${c.postId}#commentaires`} className="line-clamp-2 text-[15px] leading-snug hover:text-accent">{c.body}</Link>
                      <span className="block text-xs text-muted">Sous « {c.postTitle} » · {plural(c.replies, "réponse")}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div>
          <h2 id="publications-titre" className="mb-3 text-xl font-bold">Publications</h2>
          {posts.length === 0 ? (
            <p className="card p-5 text-muted">
              {isSelf ? <>Vous n’avez encore rien publié. <Link href="/publier" className="btn-link">Partager une découverte →</Link></> : "Aucune publication publique pour l’instant."}
            </p>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} reactions={reactions.get(post.id)} viewer={viewer} />
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="mt-4 text-center">
              <Link href={`/m/${member.handle}?n=${limit + FEED_PAGE}`} scroll={false} className="btn-secondary">Afficher plus</Link>
            </div>
          )}
          {isSelf && posts.length > 0 && !pinned && <p className="mt-3 text-xs text-muted">Astuce : ouvrez une de vos publications et choisissez « Épingler sur mon profil » pour la mettre en tête.</p>}
          </div>
        </section>

        <aside className="space-y-4" aria-label="Domaines et salons du membre">
          <section className="card p-5">
            <h2 className="label-mono">Activité · {ACTIVITY_WEEKS} semaines</h2>
            <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Calendrier d’activité, défilement horizontal"><ActivityCalendar days={calendar} /></div>
          </section>
          <section className="card p-5">
            <h2 className="label-mono">Salons publics</h2>
            <p className="mt-1 text-xs text-muted">Les salons sur invitation n’apparaissent jamais sur un profil.</p>
            {activity.rooms.length ? (
              <ul className="mt-2 divide-y divide-line">
                {activity.rooms.map((r) => (
                  <li key={r.id} className="py-2">
                    <Link href={`/s/${r.id}`} className="font-semibold text-accent hover:underline">{r.name}</Link>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {ROLE_LABEL[r.role] && <span className="chip">{ROLE_LABEL[r.role]}</span>}
                      {r.themeName && <span className="chip">{r.themeName}</span>}
                      <span className="text-muted">{plural(r.members, "membre")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Aucun salon public.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
