import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRoomView } from "@/lib/data/rooms";
import { getPost } from "@/lib/data/posts";
import { displayHost } from "@/lib/urls";
import { ThemeTile } from "@/components/ThemeTile";
import { chatSnapshot, previewMessages } from "@/lib/rooms/chat.ts";
import { canJoinRoom, canWriteRoom } from "@/lib/rooms/permissions.ts";
import { LocalTime } from "@/components/LocalTime";
import { InviteButton, JoinButton, MemberActions, MemberBar, TransferBanner } from "./RoomActions";
import { RoomChat, type ChatMessage } from "./RoomChat";
import { RoomMeetups } from "./RoomMeetups";
import { listMeetups } from "@/lib/rooms/meetups.ts";

type Params = Promise<{ id: string }>;

/** Un salon public partagé montre son nom et son sujet ; un privé ne révèle rien (SEO C022). */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Salon", robots: { index: false } };
  const [room] = await db.query<{ name: string; description: string; visibility: string }>(
    `SELECT name, description, visibility FROM rooms WHERE id = $1`,
    [id],
  );
  if (!room || room.visibility !== "public") return { title: "Salon", robots: { index: false } };
  const description = room.description || "Une discussion de groupe sur Valyo, le réseau des passionnés de tech et de sciences.";
  return {
    title: `${room.name} — salon`,
    description,
    alternates: { canonical: `/s/${id}` },
    openGraph: { title: room.name, description, url: `/s/${id}` },
  };
}

/** Charge l'historique et le curseur côté serveur, puis laisse le client suivre le flux SSE. */
async function ChatSection({
  roomId,
  viewer,
  canWrite,
  canModerate,
}: {
  roomId: string;
  viewer: { id: string; status: string; onboarded: boolean };
  canWrite: boolean;
  canModerate: boolean;
}) {
  const snapshot = await chatSnapshot(db, viewer, roomId);
  if (!snapshot) return <p role="status">Votre accès à cette discussion a été retiré.</p>;
  return (
    <RoomChat
      roomId={roomId}
      initialMessages={snapshot.messages as ChatMessage[]}
      initialHasMore={snapshot.hasMore}
      initialCursor={snapshot.cursor}
      lastReadSeq={snapshot.lastReadSeq}
      viewerId={viewer.id}
      canWrite={canWrite}
      canModerate={canModerate}
    />
  );
}

// Page d'un salon (F10, F11). Un salon privé renvoie 404 aux non-membres : rien ne fuit.
export default async function RoomPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const roomViewer = user ? { id: user.id, status: user.status, onboarded: user.onboarded } : null;
  const view = await getRoomView(id, roomViewer);
  if (!view) notFound();
  // Salon public : la discussion est visible de tous, en lecture seule, même sans compte.
  const preview = view.canRead ? null : await previewMessages(db.query, roomViewer, id);
  // Article(s) à l'origine du salon : affichés en tête pour que la discussion garde son sujet.
  const origins = (await Promise.all(view.postIds.map((postId) => getPost(postId)))).filter((p): p is NonNullable<typeof p> => Boolean(p && p.status === "published"));
  const meetups = await listMeetups(db.query, id);
  const { card, access, members } = view;
  const isMember = Boolean(access.membership);
  const roleLabel: Record<string, string> = { owner: "Propriétaire", moderator: "Modération", member: "" };

  return (
    <div className="wide-page space-y-5">
      <Link href="/salons" className="btn-link">← Tous les salons</Link>
      {view.openTransferForViewer && <TransferBanner transferId={view.openTransferForViewer.id} roomName={card.name} />}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2"><span className="chip bg-accent-soft text-accent">{card.visibility === "private" ? "Sur invitation" : "Salon public"}</span>{card.themeName && <span className="chip">{card.themeName}</span>}{card.archived && <span className="chip">Archivé · lecture seule</span>}</div>
          <h1 className="text-2xl font-bold sm:text-3xl">{card.name}</h1>
          <p className="mt-2 text-sm text-muted">{card.members} membre{card.members > 1 ? "s" : ""} · {card.recentMessages} message{card.recentMessages > 1 ? "s" : ""} sur 7 jours</p>
        </div>
        {(view.canRead || preview) && <Link href={canWriteRoom(access) ? `#compose-${card.id}` : "#chat"} className="btn-secondary">{canWriteRoom(access) ? "Écrire un message ↓" : "Lire la discussion ↓"}</Link>}
      </header>
      {origins.map((post) => (
        <section key={post.id} aria-label="Article à l’origine du salon" className="card flex gap-4 p-4 sm:p-5">
          {post.imageUrl || post.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl ?? `/media/${post.images[0].id}`} alt="" referrerPolicy="no-referrer" className="hidden h-24 w-36 shrink-0 rounded-lg object-cover sm:block" />
          ) : post.themes[0] ? (
            <span className="hidden sm:block"><ThemeTile slug={post.themes[0].slug} name={post.themes[0].name} size="lg" /></span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="label-mono text-accent">Le salon discute de cet article</p>
            <h2 className="mt-1 font-display text-lg font-semibold leading-snug">
              <Link href={`/p/${post.id}`} className="hover:text-accent">{post.title}</Link>
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {post.sourceName ?? post.author.displayName}{post.themes[0] ? ` · ${post.themes[0].name}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
              <Link href={`/p/${post.id}`} className="text-accent hover:underline">Voir l’article et ses commentaires →</Link>
              {post.sources[0] && (
                <a href={post.sources[0]} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
                  {post.sourceName ? `Lire sur ${post.sourceName} ↗` : `Source · ${displayHost(post.sources[0])} ↗`}
                </a>
              )}
            </div>
          </div>
        </section>
      ))}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {view.canRead && user ? (
          <section className="card min-w-0 overflow-hidden" aria-labelledby="chat">
            <div className="border-b border-line px-4 py-3 sm:px-5"><h2 id="chat" className="text-base font-bold">Discussion</h2></div>
            <div className="p-3 sm:p-5" id="compose-message">
              <ChatSection roomId={card.id} viewer={{ id: user.id, status: user.status, onboarded: user.onboarded }} canWrite={canWriteRoom(access)} canModerate={view.canModerate} />
            </div>
          </section>
        ) : preview ? (
          <section className="card min-w-0 overflow-hidden" aria-labelledby="chat">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
              <h2 id="chat" className="text-base font-bold">Discussion</h2>
              <span className="label-mono">Lecture seule · salon public</span>
            </div>
            <ol className="max-h-[60vh] space-y-3 overflow-y-auto p-4 sm:p-5">
              {preview.length === 0 && <li className="py-8 text-center text-sm text-muted">Pas encore de message. Rejoignez le salon pour lancer la discussion.</li>}
              {preview.map((m) => (
                <li key={m.id} className="text-[15px]">
                  <p className="text-sm">
                    {m.authorHandle ? <Link href={`/m/${m.authorHandle}`} className="font-semibold hover:underline">{m.authorName}</Link> : <span className="font-semibold">{m.authorName}</span>}
                    <span className="text-xs text-muted"> · <LocalTime iso={m.createdAt} /></span>
                  </p>
                  <p className={`mt-0.5 whitespace-pre-wrap break-words leading-relaxed ${m.deleted || m.removedByModeration ? "italic text-muted" : ""}`}>
                    {m.removedByModeration ? "Message retiré par la modération." : m.deleted ? "Message supprimé." : m.body}
                  </p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-4 py-3 sm:px-5">
              <p className="text-sm text-soft">{card.archived ? "Discussion archivée : elle n’accepte plus de messages." : "Rejoignez le salon pour participer à la discussion."}</p>
              {canJoinRoom(access) ? <JoinButton roomId={card.id} openChat /> : !user && !card.archived ? <Link href={`/connexion?next=${encodeURIComponent(`/s/${card.id}#chat`)}`} className="btn-primary">Se connecter pour participer</Link> : user && !user.onboarded && !card.archived ? <Link href={`/bienvenue?next=${encodeURIComponent(`/s/${card.id}#chat`)}`} className="btn-primary">Terminer mon inscription</Link> : null}
            </div>
          </section>
        ) : (
          <section className="card flex min-h-80 flex-col items-center justify-center px-6 py-10 text-center" aria-labelledby="rejoindre-discussion">
            <span aria-hidden className="mb-4 flex h-16 w-16 items-center justify-center rounded-card bg-accent-soft text-3xl text-accent">↔</span>
            <h2 id="rejoindre-discussion" className="text-2xl font-bold">{card.archived ? "Cette discussion est archivée." : isMember ? "Discussion indisponible" : "Prenez part à la conversation."}</h2>
            <p className="mb-6 mt-3 max-w-md text-sm leading-relaxed text-soft">{card.archived ? "Les membres conservent l’accès à l’historique. Le salon n’accepte plus d’adhésions ni de messages." : isMember ? "Votre compte ne permet plus de consulter ce chat pour le moment." : "Rejoignez le salon pour lire les échanges, poser vos questions et partager votre point de vue."}</p>
            {canJoinRoom(access) ? <JoinButton roomId={card.id} openChat /> : !user && !card.archived ? <Link href={`/connexion?next=${encodeURIComponent(`/s/${card.id}#chat`)}`} className="btn-primary">Se connecter pour rejoindre</Link> : user && !user.onboarded && !card.archived ? <Link href={`/bienvenue?next=${encodeURIComponent(`/s/${card.id}#chat`)}`} className="btn-primary">Terminer mon inscription</Link> : <Link href="/salons" className="btn-secondary">Découvrir d’autres salons</Link>}
          </section>
        )}
        <aside className="min-w-0 space-y-4" aria-label="À propos du salon">
          {(view.canRead || preview) && !card.archived && (
            <RoomMeetups roomId={card.id} initial={meetups} canManage={Boolean(view.canModerate && isMember)} />
          )}
          <section className="card p-5">
            <h2 className="text-sm font-bold">À propos</h2>
            <p className="mt-2 text-sm leading-relaxed text-soft">{card.description || "Un espace pour échanger autour d’un même sujet, à votre rythme."}</p>
            {card.lastMessageAt && <p className="mt-3 text-xs text-muted">Dernier échange <LocalTime iso={card.lastMessageAt} /></p>}
          </section>
          {view.canRead && user && <details className="card p-5">
            <summary className="cursor-pointer text-sm font-bold">Suivi et gestion du salon</summary>
            <p className="mb-3 mt-3 text-xs text-muted">Suivez ce salon pour recevoir ses notifications.</p>
            <MemberBar roomId={card.id} roomName={card.name} following={view.following} isOwner={view.canManage} archived={card.archived} />
            {view.canModerate && !card.archived && <div className="mt-4"><InviteButton roomId={card.id} /></div>}
          </details>}
          {members && view.canRead && <details className="card p-5" open>
            <summary className="cursor-pointer text-sm font-bold">Membres ({members.length})</summary>
            <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto">
              {members.map(m => <li key={m.userId} className="py-3">
                <div className="flex items-center gap-2.5"><span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-bold text-accent">{m.displayName.trim().slice(0, 1).toLocaleUpperCase("fr")}</span><div className="min-w-0">{m.handle ? <Link href={`/m/${m.handle}`} className="text-sm font-semibold hover:underline">{m.displayName}</Link> : <span className="text-sm text-muted">{m.displayName}</span>}{roleLabel[m.role] && <p className="text-xs text-muted">{roleLabel[m.role]}</p>}</div></div>
                {view.canModerate && m.userId !== user?.id && <details className="mt-2"><summary className="cursor-pointer text-xs text-muted">Actions de modération</summary><div className="mt-2"><MemberActions roomId={card.id} userId={m.userId} role={m.role} viewerIsOwner={view.canManage} /></div></details>}
              </li>)}
            </ul>
          </details>}
        </aside>
      </div>
    </div>
  );
}
