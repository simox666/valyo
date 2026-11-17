import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOwnProfile } from "@/lib/data/members";
import { followedThemeIds, listActiveThemes } from "@/lib/data/themes";
import { DeleteAccount } from "./DeleteAccount";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { robots: { index: false }, title: "Paramètres" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/parametres");
  if (!user.onboarded) redirect("/bienvenue?next=/parametres");
  const [profile, themes, themeIds] = await Promise.all([getOwnProfile(user.id), listActiveThemes(), followedThemeIds(user.id)]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Paramètres</h1>

      <section className="card space-y-4 p-5" aria-labelledby="compte-titre">
        <h2 id="compte-titre" className="text-lg font-bold">
          Compte
        </h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="font-semibold">Pseudonyme</dt>
          <dd>@{profile?.handle}</dd>
          <dt className="font-semibold">Adresse e-mail</dt>
          <dd>
            {profile?.email} <span className="text-neutral-500">(visible par vous seul)</span>
          </dd>
        </dl>
      </section>

      <section className="card p-5" aria-labelledby="profil-titre">
        <h2 id="profil-titre" className="mb-4 text-lg font-bold">
          Votre carte de visite
        </h2>
        <ProfileForm
          themes={themes}
          initial={{
            displayName: profile?.display_name ?? "",
            bio: profile?.bio ?? "",
            themeIds,
            headline: profile?.headline ?? "",
            specialties: profile?.specialties ?? [],
            links: profile?.links ?? [],
            askMe: profile?.ask_me ?? "",
            lookingFor: profile?.looking_for ?? "",
            avatarImageId: profile?.avatar_image_id ?? null,
            bannerImageId: profile?.banner_image_id ?? null,
          }}
        />
      </section>

      <section className="card border-red-200 p-5" aria-labelledby="suppression-titre">
        <h2 id="suppression-titre" className="text-lg font-bold">
          Supprimer mon compte
        </h2>
        <DeleteAccount />
      </section>
    </div>
  );
}
