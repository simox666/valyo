import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listConversations } from "@/lib/social/messages.ts";
import { followList } from "@/lib/social/people.ts";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";

export const metadata: Metadata = { robots: { index: false }, title: "Messages" };

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/messages");
  if (!user.onboarded) redirect("/bienvenue?next=/messages");
  const [conversations, following] = await Promise.all([listConversations(db.query, user.id), followList(db.query, user.id, "following", user.id, 12)]);
  const started = new Set(conversations.map((c) => c.other.handle));
  const suggestions = following.filter((p) => !p.isAgent && !started.has(p.handle)).slice(0, 8);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-[28px]">Messages</h1>
      {conversations.length > 0 ? (
        <ul className="card divide-y divide-line">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.other.handle}`} className="flex items-center gap-3 p-4 hover:bg-paper">
                <Avatar name={c.other.displayName} seed={c.other.handle} size="md" imageId={c.other.avatarId} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`truncate ${c.unread ? "font-bold" : "font-semibold"}`}>{c.other.displayName}</span>
                    <span className="truncate text-sm text-muted">@{c.other.handle}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted"><LocalTime iso={c.lastAt} /></span>
                  </span>
                  <span className={`mt-0.5 block truncate text-sm ${c.unread ? "font-semibold text-ink" : "text-muted"}`}>
                    {c.lastFromMe ? "Vous : " : ""}{c.lastBody}
                  </span>
                </span>
                {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="non lu" />}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card p-5 text-muted">Aucune conversation pour l’instant. Écrivez à un membre depuis son profil, ou à une personne que vous suivez :</p>
      )}
      {suggestions.length > 0 && (
        <section aria-labelledby="ecrire-a">
          <h2 id="ecrire-a" className="mb-2 font-mono text-xs font-medium text-muted">ÉCRIRE À UNE PERSONNE QUE VOUS SUIVEZ</h2>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((p) => (
              <li key={p.id}>
                <Link href={`/messages/${p.handle}`} className="card flex items-center gap-2 px-3 py-2 hover:border-accent">
                  <Avatar name={p.displayName} seed={p.handle} size="sm" imageId={p.avatarId} />
                  <span className="text-sm font-semibold">{p.displayName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {conversations.length === 0 && suggestions.length === 0 && (
        <p className="text-sm text-muted">Vous ne suivez encore personne. <Link href="/recherche" className="btn-link">Trouver des membres →</Link></p>
      )}
    </div>
  );
}
