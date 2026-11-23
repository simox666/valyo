import Link from "next/link";
import { roomsForPost } from "@/lib/data/rooms";
import { JoinButton } from "@/app/s/[id]/RoomActions";
import { LocalTime } from "./LocalTime";
import type { LinkedRoom } from "@/lib/rooms/discovery.ts";

export async function PostRooms({ postId, viewerId, canCreate }: { postId: string; viewerId: string | null; canCreate: boolean }) {
  const { rooms } = await roomsForPost(postId, viewerId, Number.MAX_SAFE_INTEGER);
  function roomRow(room: LinkedRoom) {
    const destination = `/s/${room.id}#chat`;
    return <li key={room.id} className="min-w-0 py-4">
      <Link href={destination} className="font-bold text-accent hover:underline">{room.name}</Link>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {room.visibility === "private" && <span className="chip">Sur invitation</span>}
        {room.archived && <span className="chip">Archivé</span>}
        {room.themeName && <span className="chip">{room.themeName}</span>}
      </div>
      <p className="mt-2 text-xs text-soft">{room.members} membre{room.members > 1 ? "s" : ""} · {room.recentMessages} message{room.recentMessages > 1 ? "s" : ""} sur 7 jours</p>
      {room.lastMessageAt && <p className="mt-1 text-xs text-muted">Dernier message <LocalTime iso={room.lastMessageAt} /></p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {room.isMember ? <Link href={destination} className="btn-primary">Ouvrir la discussion</Link> : <>
          {/* Salon public : sa discussion se lit sans en être membre, même sans compte. */}
          <Link href={destination} className="btn-secondary">Lire la discussion</Link>
          {!room.archived && canCreate && <JoinButton roomId={room.id} openChat />}
        </>}
      </div>
    </li>;
  }
  const createPath = `/salons/nouveau?post=${postId}`;
  return <section className="card p-5" aria-labelledby="salons-associes">
    <p className="label-mono">Pour aller plus loin</p>
    <h2 id="salons-associes" className="mt-1 text-lg font-bold">Discuter dans un salon</h2>
    <p className="mt-2 text-sm text-soft">Une discussion de groupe pour approfondir cette publication.</p>
    {rooms.length ? <>
      <ul className="divide-y divide-line">{rooms.slice(0, 3).map(roomRow)}</ul>
      {rooms.length > 3 && <details className="mb-3"><summary className="cursor-pointer text-sm font-semibold text-accent">Voir les {rooms.length - 3} autres salons associés</summary><ul className="divide-y divide-line">{rooms.slice(3).map(roomRow)}</ul></details>}
    </> : <p className="my-4 text-sm text-soft">Aucun salon ne discute encore de cette publication.</p>}
    {(canCreate || !viewerId) && <Link href={canCreate ? createPath : `/connexion?next=${encodeURIComponent(createPath)}`} className={rooms.length ? "btn-secondary" : "btn-primary"}>{rooms.length ? "Ouvrir un autre salon" : "Ouvrir un salon sur ce sujet"}</Link>}
  </section>;
}
