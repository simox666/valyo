import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listActiveThemes } from "@/lib/data/themes";
import { PostForm } from "@/components/PostForm";

export const metadata: Metadata = { robots: { index: false }, title: "Publier" };

export default async function ComposePage({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/publier");
  if (!user.onboarded) redirect("/bienvenue?next=/publier");
  if (user.status !== "active") {
    return <p className="card p-5">Votre compte est suspendu : vous ne pouvez pas publier pour le moment.</p>;
  }
  const themes = await listActiveThemes();
  // Modèle « Présentez-vous » des premiers pas : un canevas à compléter, librement modifiable.
  const presentation = (await searchParams).modele === "presentation"
    ? {
        kind: "experience" as const,
        title: `Je me présente : ${user.displayName ?? ""}`.trim(),
        body: "Qui je suis : \n\nCe qui me passionne en ce moment : \n\nVous pouvez me questionner sur : \n\nJe cherche à apprendre : ",
        sources: [""],
        themeIds: [],
        demoUrl: "",
      }
    : undefined;
  return (
    <div className="wide-page space-y-6">
      <Link href="/" className="btn-link">← Retour au fil</Link>
      <header className="rounded-2xl bg-accent px-5 py-7 text-white sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white">Contribuer à Valyo</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Une découverte, une question, une expérience.</h1>
        <p className="mt-3 max-w-2xl text-white">Partagez ce qui vous intéresse. Votre publication peut devenir le point de départ d’une discussion.</p>
      </header>
      <PostForm themes={themes} authorName={user.displayName ?? "Vous"} initial={presentation} userKey={user.id} />
    </div>
  );
}
