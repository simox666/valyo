"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocalTime } from "@/components/LocalTime";
import type { RoomCard } from "@/lib/rooms/discovery.ts";

type MyRoom = RoomCard & { role: string; following: boolean; unread: number };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");

export function RoomDirectory({ publicRooms, myRooms, signedIn }: { publicRooms: RoomCard[]; myRooms: MyRoom[]; signedIn: boolean }) {
  const [view, setView] = useState<"discover" | "mine">(myRooms.length ? "mine" : "discover");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("");
  const [archives, setArchives] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#mes-salons" && signedIn) setView("mine");
  }, [signedIn]);
  const mine = new Map(myRooms.map(room => [room.id, room]));
  const source = view === "mine" ? myRooms : publicRooms;
  const themes = [...new Set([...publicRooms, ...myRooms].map(room => room.themeName).filter((name): name is string => Boolean(name)))];
  const rooms = source.filter(room => (archives || !room.archived) && (!theme || room.themeName === theme) && normalize(`${room.name} ${room.description} ${room.themeName ?? ""}`).includes(normalize(search)));
  const unread = myRooms.reduce((n, room) => n + room.unread, 0);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4" id="mes-salons">
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-chip p-1" role="group" aria-label="Choisir les salons à afficher">
        <button onClick={() => setView("discover")} aria-pressed={view === "discover"} className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "discover" ? "bg-white text-accent shadow-sm" : "text-neutral-600"}`}>Découvrir</button>
        {signedIn && <button onClick={() => setView("mine")} aria-pressed={view === "mine"} className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "mine" ? "bg-white text-accent shadow-sm" : "text-neutral-600"}`}>Mes salons <span className="ml-1 text-xs">({myRooms.length})</span></button>}
      </div>
      {signedIn && unread > 0 && <p className="text-sm font-semibold text-accent">{unread} message{unread > 1 ? "s" : ""} à lire dans vos salons</p>}
    </div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
      <div><label htmlFor="room-search" className="label">Trouver une discussion</label><input id="room-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Un sujet, un nom de salon…" className="field" /></div>
      <div><label htmlFor="room-theme" className="label">Thème</label><select id="room-theme" value={theme} onChange={e => setTheme(e.target.value)} className="field"><option value="">Tous les thèmes</option>{themes.map(name => <option key={name}>{name}</option>)}</select></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
      <p role="status">{rooms.length} salon{rooms.length > 1 ? "s" : ""} {view === "mine" ? "dans votre sélection" : "à découvrir"}{view === "discover" && " · activité des 7 derniers jours"}</p>
      <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={archives} onChange={e => setArchives(e.target.checked)} className="h-4 w-4 accent-accent" /> Inclure les archives</label>
    </div>
    {rooms.length ? <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rooms.map(room => {
      const membership = mine.get(room.id);
      return <li key={room.id} className="card flex min-w-0 flex-col overflow-hidden transition hover:border-accent/40 hover:shadow-sm">
        <div className={`flex items-center justify-between gap-3 border-b border-line px-5 py-3 ${membership ? "bg-accent-soft" : "bg-chip/50"}`}>
          <span className="text-xs font-bold uppercase tracking-wider text-accent">{room.themeName ?? "Discussion ouverte"}</span>
          <span className="chip bg-white">{room.archived ? "Archivé" : room.visibility === "private" ? "Sur invitation" : "Public"}</span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-3 flex items-center gap-2">
            {membership && <span className="chip bg-accent-soft text-accent">{membership.role === "owner" ? "Propriétaire" : membership.role === "moderator" ? "Modération" : "Membre"}</span>}
            {membership && membership.unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{membership.unread} non lu{membership.unread > 1 ? "s" : ""}</span>}
          </div>
          <h2 className="text-xl font-extrabold leading-snug"><Link href={`/s/${room.id}${membership ? "#chat" : ""}`} className="hover:underline">{room.name}</Link></h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600">{room.description || "Un espace pour poser vos questions et partager vos découvertes."}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-3">
            <p><span className="block text-xl font-bold">{room.members}</span><span className="text-xs text-neutral-500">membre{room.members > 1 ? "s" : ""}</span></p>
            <p><span className="block text-xl font-bold">{room.recentMessages}</span><span className="text-xs text-neutral-500">message{room.recentMessages > 1 ? "s" : ""} cette semaine</span></p>
          </div>
          <p className="mb-4 mt-3 text-xs text-neutral-500">{room.lastMessageAt ? <>Dernier échange <LocalTime iso={room.lastMessageAt} /></> : "La discussion attend son premier message."}</p>
          <Link href={`/s/${room.id}${membership ? "#chat" : ""}`} className={`${membership ? "btn-primary" : "btn-secondary"} mt-auto w-full`}>{membership ? "Ouvrir la discussion" : "Découvrir le salon"}<span aria-hidden>→</span></Link>
        </div>
      </li>;
    })}</ul> : <div className="card px-5 py-10 text-center">
      <p className="text-lg font-bold">{search || theme ? "Aucun salon ne correspond à votre recherche." : view === "mine" ? "Vos prochaines discussions vous attendent." : "Les premiers échanges commencent avec vous."}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-600">{view === "mine" && !search && !theme ? "Rejoignez un salon public : vous le retrouverez ici avec ses nouveaux messages." : "Essayez un autre thème ou lancez un salon sur un sujet qui vous intéresse."}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {(search || theme || archives) && <button className="btn-secondary" onClick={() => { setSearch(""); setTheme(""); setArchives(false); }}>Effacer les filtres</button>}
        {view === "mine" && <button className="btn-primary" onClick={() => { setView("discover"); setSearch(""); setTheme(""); }}>Découvrir les salons</button>}
        <Link href="/salons/nouveau" className="btn-link">Créer un salon</Link>
      </div>
    </div>}
  </div>;
}
