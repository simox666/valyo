import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEED_PAGE, listFeed } from "@/lib/data/posts";
import { reactionSummaries } from "@/lib/social/reactions.ts";
import { linkedRooms } from "@/lib/rooms/discovery.ts";
import { getSyntheses } from "@/lib/actus/synthesis.ts";
import { PostCard } from "@/components/PostCard";

export const metadata: Metadata = { robots: { index: false }, title: "À creuser" };

/** Les publications que le membre a marquées de la loupe « À creuser », pour y revenir. */
export default async function DigPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/a-creuser");
  if (!user.onboarded) redirect("/bienvenue?next=/a-creuser");
  const limit = Math.min(Math.max(Number.parseInt((await searchParams).n ?? "", 10) || FEED_PAGE, FEED_PAGE), 200);
  const { posts, hasMore } = await listFeed({ view: "recent", viewerId: user.id, diggerId: user.id, limit });
  const ids = posts.map((p) => p.id);
  const [reactions, rooms, syntheses] = await Promise.all([
    reactionSummaries(db.query, ids, user.id),
    linkedRooms(db.query, ids, user.id),
    getSyntheses(db.query, ids),
  ]);
  const viewer = { signedIn: true, canReact: user.status === "active" };

  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <header>
        <p className="label-mono text-accent">Ma liste</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-[28px]">À creuser</h1>
        <p className="mt-1 text-soft">Les sujets que vous avez marqués de la loupe pour y revenir. Cliquez de nouveau sur la loupe d’une carte pour la retirer de la liste.</p>
      </header>
      {posts.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Votre liste est vide.</p>
          <p className="mt-1 text-muted">Sous chaque publication, la loupe <span aria-hidden>🔎</span> « À creuser » la garde ici pour plus tard.</p>
          <Link href="/" className="btn-primary mt-4">Parcourir le fil</Link>
        </div>
      ) : (
        <ul className="space-y-[18px]">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} rooms={rooms.get(post.id)} reactions={reactions.get(post.id)} viewer={viewer} synthesis={syntheses.get(post.id)} />
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div className="text-center"><Link href={`/a-creuser?n=${limit + FEED_PAGE}`} scroll={false} className="btn-secondary">Afficher plus</Link></div>
      )}
    </div>
  );
}
