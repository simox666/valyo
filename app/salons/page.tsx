import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listMyRooms, listPublicRooms } from "@/lib/data/rooms";
import { RoomDirectory } from "./RoomDirectory";

export const metadata: Metadata = { title: "Salons — discussions de groupe" };

export default async function RoomsPage() {
  const user = await getCurrentUser();
  const active = Boolean(user?.onboarded && user.status === "active");
  const [publicRooms, myRooms] = await Promise.all([listPublicRooms(), active ? listMyRooms(user!.id) : Promise.resolve([])]);
  return <div className="wide-page space-y-7">
    <header className="relative overflow-hidden rounded-3xl bg-accent px-6 py-7 text-white sm:px-8 sm:py-9">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[35px] border-white/5" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">Salons · Discussions de groupe</p><h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Trouvez votre prochaine discussion.</h1><p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">Un sujet vous passionne ? Retrouvez celles et ceux qui s’y intéressent et faites avancer la conversation.</p></div>
        <Link href="/salons/nouveau" className="btn bg-white text-accent hover:bg-white/90">+ Créer un salon</Link>
      </div>
    </header>
    <RoomDirectory publicRooms={publicRooms} myRooms={myRooms} signedIn={active} />
    {!user && <p className="text-center text-sm text-neutral-600"><Link href="/connexion?next=/salons" className="btn-link">Connectez-vous</Link> pour rejoindre un salon et retrouver vos discussions.</p>}
  </div>;
}
