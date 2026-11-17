import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMemberByHandle } from "@/lib/data/members";
import { followList } from "@/lib/social/people.ts";
import { PeopleList } from "./PeopleList";

/** Page « abonnés » ou « abonnements » d'un membre, avec onglets. */
export async function FollowPage({ handle, direction }: { handle: string; direction: "followers" | "following" }) {
  const member = await getMemberByHandle(handle);
  if (!member) notFound();
  const user = await getCurrentUser();
  const people = await followList(db.query, member.id, direction, user?.id ?? null);
  const isSelf = user?.id === member.id;
  const tab = (href: string, label: string, active: boolean) => (
    <Link href={href} aria-current={active ? "page" : undefined} className={`px-3 py-2 text-sm font-semibold ${active ? "border-b-2 border-accent text-ink" : "text-muted hover:text-ink"}`}>{label}</Link>
  );
  return (
    <div className="space-y-4">
      <Link href={`/m/${member.handle}`} className="btn-link">← {member.displayName}</Link>
      <h1 className="text-2xl font-bold">{isSelf ? "Vos" : "Ses"} {direction === "followers" ? "abonnés" : "abonnements"}</h1>
      <nav aria-label="Abonnés et abonnements" className="flex gap-2 border-b border-line">
        {tab(`/m/${member.handle}/abonnes`, `${member.followers} abonné${member.followers > 1 ? "s" : ""}`, direction === "followers")}
        {tab(`/m/${member.handle}/abonnements`, `${member.following} abonnement${member.following > 1 ? "s" : ""}`, direction === "following")}
      </nav>
      <PeopleList
        people={people}
        viewer={user?.onboarded ? { id: user.id, canAct: user.status === "active" } : null}
        empty={direction === "followers" ? (isSelf ? "Personne ne vous suit encore. Publiez, commentez : on vous remarquera." : "Personne ne suit encore ce membre.") : (isSelf ? "Vous ne suivez personne pour l’instant." : "Ce membre ne suit personne pour l’instant.")}
      />
    </div>
  );
}
