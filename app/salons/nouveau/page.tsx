import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPost } from "@/lib/data/posts";
import { roomsForPost } from "@/lib/data/rooms";
import { listActiveThemes } from "@/lib/data/themes";
import { NewRoomForm } from "./NewRoomForm";

export const metadata: Metadata = { title: "Créer un salon" };

// Création d'un salon (F10), autonome ou depuis une publication. Avant de créer,
// les salons publics déjà associés sont proposés (« Rejoindre » d'abord, décision §2).
export default async function NewRoomPage({ searchParams }: { searchParams: Promise<{ post?: string }> }) {
  const { post: postParam } = await searchParams;
  const next = postParam ? `/salons/nouveau?post=${postParam}` : "/salons/nouveau";
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  if (!user.onboarded) redirect(`/bienvenue?next=${encodeURIComponent(next)}`);
  if (user.status !== "active") {
    return <p className="card p-5">Votre compte est suspendu : vous ne pouvez pas créer de salon pour le moment.</p>;
  }
  const themes = await listActiveThemes();
  const post = postParam && /^[0-9a-f-]{36}$/i.test(postParam) ? await getPost(postParam) : null;
  const origin = post && post.status === "published" ? post : null;
  const existing = origin ? await roomsForPost(origin.id, user.id) : null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Créer un salon</h1>
      {origin && (
        <p className="text-neutral-600">
          Depuis la publication <Link href={`/p/${origin.id}`} className="btn-link">{origin.title}</Link>. Le thème est prérempli et la
          publication restera associée au salon.
        </p>
      )}
      {existing && existing.rooms.length > 0 && (
        <section className="card p-5" aria-labelledby="existants">
          <h2 id="existants" className="text-lg font-bold">Des salons discutent déjà de cette publication</h2>
          <p className="mt-1 text-sm text-neutral-600">Rejoindre une discussion existante évite de la disperser. Créer un autre angle reste possible dessous.</p>
          <ul className="mt-2 divide-y divide-line">
            {existing.rooms.map((room) => (
              <li key={room.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <Link href={`/s/${room.id}`} className="font-semibold hover:underline">{room.name}</Link>{" "}
                  <span className="text-sm text-neutral-500">{room.members} membre{room.members > 1 ? "s" : ""} · {room.recentMessages} message{room.recentMessages > 1 ? "s" : ""} sur 7 jours</span>
                </span>
                <Link href={`/s/${room.id}`} className="btn-primary px-3 py-1.5">Rejoindre</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <NewRoomForm themes={themes} postId={origin?.id ?? null} initialThemeId={origin?.themes[0]?.id ?? null} />
    </div>
  );
}
