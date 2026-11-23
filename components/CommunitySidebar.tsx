import Link from "next/link";
import { LocalTime } from "./LocalTime";
import type { DiscussionCard, RoomCard } from "@/lib/rooms/discovery.ts";

function RoomLink({ room }: { room: RoomCard & { unread?: number } }) {
  return <li className="min-w-0 py-3">
    <Link href={`/s/${room.id}#chat`} className="block font-bold leading-snug text-accent hover:underline">{room.name}</Link>
    <div className="mt-1 flex flex-wrap gap-1.5">
      {room.visibility === "private" && <span className="chip">Sur invitation</span>}
      {room.archived && <span className="chip">Archivé</span>}
      {room.themeName && <span className="chip">{room.themeName}</span>}
      {room.unread !== undefined && room.unread > 0 && <span className="chip bg-accent-soft text-accent">{room.unread} non lu{room.unread > 1 ? "s" : ""}</span>}
    </div>
    <p className="mt-1 text-xs text-soft">{room.members} membre{room.members > 1 ? "s" : ""} · {room.recentMessages} message{room.recentMessages > 1 ? "s" : ""} sur 7 jours</p>
    {room.lastMessageAt && <p className="mt-1 text-xs text-muted">Dernier message <LocalTime iso={room.lastMessageAt} /></p>}
  </li>;
}

export function CommunitySidebar({ active, discussions, signedIn }: { active: RoomCard[]; discussions: DiscussionCard[]; signedIn: boolean }) {
  return <aside aria-label="La communauté" className="min-w-0 space-y-4">
    <Link href="/recap" className="card block px-5 py-[18px] transition hover:ring-accent">
      <p className="label-mono">Le récap</p>
      <p className="mt-1.5 font-display text-lg font-semibold leading-snug">L’essentiel sciences & tech, 3 fois par semaine</p>
      <p className="mt-2 text-sm font-semibold text-accent">Découvrir le récap →</p>
    </Link>
    {signedIn && discussions.length > 0 && <section className="card p-5" aria-labelledby="mes-discussions">
      <h2 id="mes-discussions" className="text-lg font-bold">Mes discussions</h2>
      {discussions.length ? <ul className="divide-y divide-line">{discussions.map(room => <RoomLink key={room.id} room={room} />)}</ul> : <p className="my-3 text-sm text-soft">Vous n’avez pas encore de discussion accessible. Rejoignez un salon pour échanger.</p>}
      <Link href="/salons#mes-salons" className="btn-link">Retrouver mes salons →</Link>
    </section>}
    <section className="card p-5" aria-labelledby="salons-actifs">
      <p className="label-mono mb-1">Salons en direct</p>
      <h2 id="salons-actifs" className="text-lg font-bold">Salons publics actifs</h2>
      <p className="mt-1 text-xs text-muted">L’activité réelle des sept derniers jours.</p>
      {active.length ? <ul className="divide-y divide-line">{active.map(room => <RoomLink key={room.id} room={room} />)}</ul> : <p className="my-3 text-sm text-ink">Ouvrez un salon sur une actu et invitez les curieux à en discuter.</p>}
      <Link href="/salons" className="btn-link">Découvrir les salons →</Link>
    </section>
    {!signedIn && <section className="rounded-card bg-ink p-5 text-white">
      <h2 className="font-bold">Une question, un point de vue ?</h2>
      <p className="mt-2 text-sm text-on-ink">Rejoignez Valyo pour commenter, publier et écrire aux membres.</p>
      <Link href="/connexion" className="btn-primary mt-3">Rejoindre la communauté</Link>
    </section>}
  </aside>;
}
