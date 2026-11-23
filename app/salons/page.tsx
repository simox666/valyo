import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listMyRooms, listPublicRooms } from "@/lib/data/rooms";
import { RoomDirectory } from "./RoomDirectory";

export const metadata: Metadata = {
  title: "Salons — discussions de groupe",
  description: "Rejoignez les salons de Valyo : des discussions de groupe entre passionnés d’IA, d’espace, de sciences et de technologie.",
  alternates: { canonical: "/salons" },
};

export default async function RoomsPage() {
  const user = await getCurrentUser();
  const active = Boolean(user?.onboarded && user.status === "active");
  const [publicRooms, myRooms] = await Promise.all([listPublicRooms(), active ? listMyRooms(user!.id) : Promise.resolve([])]);
  return <div className="wide-page space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-[10px] bg-ink p-4 text-white sm:p-6">
      <div className="max-w-xl">
        <p className="label-mono text-[#B9C1CB]">Salons · discussions de groupe</p>
        <h1 className="mt-1.5 text-xl font-semibold leading-snug sm:text-2xl">Trouvez votre prochaine discussion.</h1>
        <p className="mt-1.5 text-sm text-[#C9CED6]">Un sujet vous passionne ? Retrouvez celles et ceux qui s’y intéressent et faites avancer la conversation.</p>
      </div>
      <Link href="/salons/nouveau" className="btn-primary">+ Créer un salon</Link>
    </header>
    <RoomDirectory publicRooms={publicRooms} myRooms={myRooms} signedIn={active} />
    {!user && <p className="text-center text-sm text-neutral-600"><Link href="/connexion?next=/salons" className="btn-link">Connectez-vous</Link> pour rejoindre un salon et retrouver vos discussions.</p>}
  </div>;
}
