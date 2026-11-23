import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = { title: "Votre avis", robots: { index: false } };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = safeNextPath((await searchParams).page);
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="label-mono text-accent">Bêta</p>
        <h1 className="mt-2 text-3xl font-bold">Votre avis compte</h1>
        <p className="mt-2 text-soft">
          Valyo est en construction avec ses premiers membres. Un bug, une idée, quelque chose qui vous agace ou vous plaît : dites-le, c’est
          lu et ça oriente la suite.
        </p>
      </header>
      <section className="card p-5 sm:p-6">
        {user?.onboarded ? (
          <FeedbackForm page={page === "/" ? "" : page} />
        ) : (
          <p className="text-soft">
            <Link href={`/connexion?next=${encodeURIComponent("/avis")}`} className="btn-link">Connectez-vous</Link> pour envoyer votre avis.
          </p>
        )}
      </section>
    </div>
  );
}
