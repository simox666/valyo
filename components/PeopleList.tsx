import Link from "next/link";
import type { PersonRow } from "@/lib/social/people.ts";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";

/** Liste de membres : nom, présentation, suivi réciproque, Suivre et Message. */
export function PeopleList({ people, viewer, empty }: { people: PersonRow[]; viewer: { id: string; canAct: boolean } | null; empty: string }) {
  if (!people.length) return <p className="card p-5 text-muted">{empty}</p>;
  return (
    <ul className="card divide-y divide-line">
      {people.map((p) => (
        <li key={p.id} className="flex items-center gap-3 p-4">
          <Link href={`/m/${p.handle}`} className="shrink-0" tabIndex={-1} aria-hidden><Avatar name={p.displayName} seed={p.handle} size="md" agent={p.isAgent} imageId={p.avatarId} /></Link>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2">
              <Link href={`/m/${p.handle}`} className="font-semibold hover:underline">{p.displayName}</Link>
              <span className="text-sm text-muted">@{p.handle}</span>
              {p.followsViewer && viewer?.id !== p.id && <span className="chip">vous suit</span>}
            </p>
            {p.bio && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{p.bio}</p>}
          </div>
          {viewer && viewer.id !== p.id && !p.isAgent && (
            <div className="flex shrink-0 items-center gap-2">
              {viewer.canAct && <Link href={`/messages/${p.handle}`} className="btn-secondary px-3 py-2" aria-label={`Écrire à ${p.displayName}`}>Message</Link>}
              <FollowButton target="member" keyValue={p.handle} initialFollowing={p.followedByViewer} signedIn label="" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
