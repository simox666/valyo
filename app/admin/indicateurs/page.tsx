import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { activitySplit, connectionCohorts, roomsActivity } from "@/lib/data/metrics";

export const metadata: Metadata = { title: "Indicateurs", robots: { index: false } };

const pct = (part: number, total: number) => (total === 0 ? "—" : `${Math.round((part / total) * 100)} %`);

export default async function MetricsPage() {
  const user = await getCurrentUser();
  // Page inexistante pour qui n'est pas administrateur : on ne révèle pas son existence.
  if (!user?.isAdmin) notFound();
  const [cohorts, split, rooms] = await Promise.all([connectionCohorts(8), activitySplit(), roomsActivity()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Indicateurs</h1>
        <p className="mt-1 text-neutral-600">Chiffres agrégés. Aucun contenu de conversation n’est lu pour les calculer.</p>
      </div>

      <section className="card p-5" aria-labelledby="liens-titre">
        <h2 id="liens-titre" className="text-lg font-bold">
          Nouveaux membres reliés et revenus
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Par semaine d’inscription. <strong>Relié</strong> : a échangé avec un autre humain dans ses 7 premiers jours (les échanges avec l’agent
          éditorial ne comptent pas). <strong>Revenu</strong> : actif entre le 8e et le 14e jour.
        </p>
        {cohorts.length === 0 ? (
          <p className="mt-4 text-neutral-600">Aucune inscription sur les 8 dernières semaines.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-line text-neutral-600">
                <tr>
                  <th scope="col" className="py-2 pr-3">Semaine du</th>
                  <th scope="col" className="py-2 pr-3">Inscrits</th>
                  <th scope="col" className="py-2 pr-3">Reliés</th>
                  <th scope="col" className="py-2 pr-3">Revenus</th>
                  <th scope="col" className="py-2 pr-3">Reliés et revenus</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.week} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-3 font-semibold">
                      {c.week.split("-").reverse().join("/")}
                      {!c.complete && <span className="ml-2 chip">en cours</span>}
                    </th>
                    <td className="py-2 pr-3">{c.new_members}</td>
                    <td className="py-2 pr-3">{c.linked} ({pct(c.linked, c.new_members)})</td>
                    <td className="py-2 pr-3">{c.returned} ({pct(c.returned, c.new_members)})</td>
                    <td className="py-2 pr-3 font-bold">
                      {c.linked_and_returned} ({pct(c.linked_and_returned, c.new_members)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-neutral-600">« En cours » : les 14 jours de suivi ne sont pas écoulés, le chiffre peut encore monter.</p>
      </section>

      <section className="card p-5" aria-labelledby="activite-titre">
        <h2 id="activite-titre" className="text-lg font-bold">
          7 derniers jours
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <dt className="text-neutral-600">Membres actifs</dt>
          <dd className="font-semibold">{split.weekly_active_members}</dd>
          <dt className="text-neutral-600">Publications de membres</dt>
          <dd className="font-semibold">{split.human_posts}</dd>
          <dt className="text-neutral-600">Publications de l’agent éditorial</dt>
          <dd className="font-semibold">{split.agent_posts}</dd>
          <dt className="text-neutral-600">Commentaires de membres</dt>
          <dd className="font-semibold">{split.human_comments}</dd>
          <dt className="text-neutral-600">Publications ayant reçu une réponse d’un autre membre</dt>
          <dd className="font-semibold">
            {split.posts_with_human_reply} sur {split.published_posts} ({pct(split.posts_with_human_reply, split.published_posts)})
          </dd>
        </dl>
      </section>

      <section className="card p-5" aria-labelledby="salons-titre">
        <h2 id="salons-titre" className="text-lg font-bold">Salons et chat (7 derniers jours)</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Agrégats uniquement : aucun contenu de conversation n’est lu, et les totaux ne distinguent pas les salons privés des publics.
          Lecture (adhésion, suivi) et contribution (écriture) sont séparées.
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <dt className="text-neutral-600">Salons actifs (non archivés)</dt>
          <dd className="font-semibold">{rooms.active_rooms}</dd>
          <dt className="text-neutral-600">Salons créés</dt>
          <dd className="font-semibold">{rooms.rooms_created}</dd>
          <dt className="text-neutral-600">Salons avec au moins un message</dt>
          <dd className="font-semibold">{rooms.rooms_with_activity} sur {rooms.active_rooms} ({pct(rooms.rooms_with_activity, rooms.active_rooms)})</dd>
          <dt className="text-neutral-600">Messages envoyés</dt>
          <dd className="font-semibold">{rooms.messages}</dd>
          <dt className="text-neutral-600">Membres ayant écrit (contribution)</dt>
          <dd className="font-semibold">{rooms.writers}</dd>
          <dt className="text-neutral-600">Membres d’au moins un salon (lecture)</dt>
          <dd className="font-semibold">{rooms.members}, dont {rooms.followers} suiveur{rooms.followers > 1 ? "s" : ""}</dd>
        </dl>
      </section>
    </div>
  );
}
