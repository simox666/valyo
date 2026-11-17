import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AcceptForm } from "./AcceptForm";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

// Ouverture d'un lien d'invitation (F11) : connexion exigée, puis acceptation EXPLICITE.
// La page ne révèle rien du salon tant que l'invitation n'est pas acceptée.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const next = `/invitations/${token}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  if (!user.onboarded) redirect(`/bienvenue?next=${encodeURIComponent(next)}`);

  return (
    <div className="card p-6 text-center">
      <h1 className="text-xl font-bold">Invitation à un salon</h1>
      <p className="mt-2 text-neutral-600">
        On vous invite à rejoindre un salon. L’invitation est à usage unique et expire d’elle-même ; rien n’est accepté sans votre accord.
      </p>
      <div className="mt-4 flex justify-center">
        <AcceptForm token={token} />
      </div>
      <p className="mt-4 text-sm">
        <Link href="/salons" className="btn-link">Voir les salons publics</Link>
      </p>
    </div>
  );
}
