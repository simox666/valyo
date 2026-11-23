import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listNotifications, unreadNotificationCount } from "@/lib/social/notifications.ts";
import { MarkAllReadButton } from "./MarkReadButton";
import { NotificationInbox } from "./NotificationInbox";
import { PushToggle } from "@/components/PushToggle";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/notifications");
  if (!user.onboarded) redirect("/bienvenue?next=/notifications");
  const [notifications, unread] = await Promise.all([listNotifications(db.query, user.id), unreadNotificationCount(db.query, user.id)]);
  const canMark = user.status === "active";
  return <div className="wide-page space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div><p className="label-mono text-accent">Le fil de vos échanges</p><h1 className="mt-2 text-3xl font-bold">Notifications</h1><p className="mt-2 text-sm text-soft">{unread ? `${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}. Retrouvez les conversations qui vous concernent.` : "Vos réponses, vos salons et les informations de votre compte."}</p></div>
      {unread > 0 && canMark && <MarkAllReadButton />}
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <NotificationInbox initialNotifications={notifications} canMark={canMark} />
      <aside className="space-y-4">
        {canMark && <PushToggle />}
        <section className="rounded-card bg-accent-soft p-5"><h2 className="font-bold">Gardez le fil.</h2><p className="mt-2 text-sm leading-relaxed text-soft">Dans un salon, ouvrez « Suivi et gestion » puis activez le suivi pour recevoir les nouveaux échanges ici.</p><Link href="/salons#mes-salons" className="btn-link mt-4 block">Retrouver mes salons →</Link></section>
        <section className="card p-5"><h2 className="font-bold">Votre compte</h2><div className="mt-3 flex flex-col gap-3"><Link href="/parametres" className="btn-link">Paramètres et thèmes suivis</Link><Link href="/sanctions" className="btn-link">Sanctions et contestations</Link></div></section>
      </aside>
    </div>
  </div>;
}
