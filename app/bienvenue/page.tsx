import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { listActiveThemes } from "@/lib/data/themes";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { robots: { index: false }, title: "Bienvenue" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  if (user.onboarded) redirect(next);
  const themes = await listActiveThemes();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Bienvenue sur Valyo</h1>
      <p className="mt-2 text-soft">Choisissez comment vous apparaîtrez auprès des autres membres.</p>
      <OnboardingForm next={next} themes={themes} />
    </div>
  );
}
