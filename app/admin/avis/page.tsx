import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEEDBACK_LABELS, listFeedback } from "@/lib/social/feedback.ts";
import { LocalTime } from "@/components/LocalTime";
import { FeedbackStatusButton } from "./FeedbackStatusButton";

export const metadata: Metadata = { title: "Avis des testeurs", robots: { index: false } };

export default async function AdminFeedbackPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  const items = await listFeedback(db.query);
  const fresh = items.filter((i) => i.status === "nouveau").length;
  return (
    <div className="wide-page space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Avis des testeurs</h1>
        <p className="mt-1 text-soft">{fresh} nouveau{fresh > 1 ? "x" : ""} · {items.length} au total</p>
      </header>
      {items.length === 0 ? (
        <p className="card p-5 text-soft">Aucun avis pour l’instant. Le lien « Votre avis » est dans le pied de page et le menu Compte.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((f) => (
            <li key={f.id} className={`card p-5 ${f.status === "traite" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${f.kind === "bug" ? "bg-red-100 text-red-800" : f.kind === "idee" ? "bg-accent-soft text-accent" : "bg-chip"}`}>{FEEDBACK_LABELS[f.kind]}</span>
                  {f.handle ? <Link href={`/m/${f.handle}`} className="font-semibold hover:underline">{f.name}</Link> : <span>{f.name}</span>}
                  <span className="text-muted"><LocalTime iso={f.createdAt} mode="full" /></span>
                  {f.page && <Link href={f.page} className="btn-link text-xs">{f.page}</Link>}
                </p>
                <FeedbackStatusButton id={f.id} status={f.status} />
              </div>
              <p className="mt-2 whitespace-pre-wrap">{f.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
