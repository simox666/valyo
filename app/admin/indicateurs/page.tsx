import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { activitySplit, connectionCohorts, roomsActivity, usageDashboard } from "@/lib/data/metrics";
import type { UsageDay } from "@/lib/metrics-sql";

export const metadata: Metadata = { title: "Statistiques", robots: { index: false } };
// Chiffres du moment : jamais de version en cache.
export const dynamic = "force-dynamic";

const pct = (part: number, total: number) => (total === 0 ? "—" : `${Math.round((part / total) * 100)} %`);
const frDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const money = (micros: number) => `${(micros / 1e6).toFixed(2).replace(".", ",")} $`;

const ACTION_LABELS: [string, string][] = [
  ["publications", "Publications"], ["commentaires", "Commentaires"], ["reactions", "Réactions"], ["relais", "Relais à ses abonnés"],
  ["messages_salon", "Messages en salon"], ["messages_prives", "Messages privés"], ["abonnements", "Abonnements à un membre"],
  ["parties", "Parties de jeux comptées"], ["syntheses", "Synthèses IA demandées"],
];
const GAME_LABELS: Record<string, string> = {
  defi: "Défi du jour", hebdo: "Quiz de la semaine", quiz: "Quiz libre", echelle: "À l’échelle", courbe: "Dessine la courbe", frise: "La frise",
  vf: "Vrai ou faux (ancien)", duel: "Plus ou moins (ancien)",
};

/** Chiffre clé : la valeur, ce qu'elle représente, et l'écart avec les 7 jours précédents quand il a un sens. */
function Tile({ label, value, note, delta }: { label: string; value: number; note: string; delta?: number }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="label-mono">{label}</p>
      <p className="mt-1 font-display text-[30px] font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-soft">{note}</p>
      {delta !== undefined && (
        <p className="mt-0.5 text-xs font-medium text-muted">
          <span aria-hidden>{delta > 0 ? "▲" : delta < 0 ? "▼" : "＝"}</span> {delta > 0 ? "+" : ""}{delta === 0 ? "comme" : delta} {delta === 0 ? "les" : "par rapport aux"} 7 jours précédents
        </p>
      )}
    </div>
  );
}

/** Barres quotidiennes d'une seule série : fines, arrondies en tête, grille discrète ; la valeur de chaque jour au survol. */
function DailyBars({ title, unit, days, pick }: { title: string; unit: string; days: UsageDay[]; pick: (d: UsageDay) => number }) {
  const W = 600, H = 150, LEFT = 30, TOP = 10, BOTTOM = 22;
  const values = days.map(pick);
  const max = Math.max(1, ...values);
  const top = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const slot = (W - LEFT) / days.length;
  const y = (v: number) => TOP + (1 - v / top) * (H - TOP - BOTTOM);
  const total = values.reduce((n, v) => n + v, 0);
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted">maximum {max} · moyenne {(total / Math.max(1, days.length)).toFixed(1).replace(".", ",")}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} sur ${days.length} jours : maximum ${max}`} className="mt-2 w-full">
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={v === 0 ? 1.2 : 0.6} />
            <text x={LEFT - 6} y={y(v) + 3.5} textAnchor="end" className="fill-muted font-mono" fontSize="10">{v}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const v = values[i];
          const h = y(0) - y(v);
          return (
            <g key={d.day}>
              <title>{`${frDay(d.day)} : ${v} ${unit}`}</title>
              <rect x={LEFT + i * slot} y={TOP} width={slot} height={H - TOP - BOTTOM} fill="transparent" />
              {v > 0 && <rect x={LEFT + i * slot + 1.5} y={y(v)} width={slot - 3} height={Math.max(h, 2)} rx={Math.min(3, (slot - 3) / 2)} className="fill-ink" />}
            </g>
          );
        })}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => days[i] && (
          <text key={i} x={LEFT + i * slot + slot / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} className="fill-muted font-mono" fontSize="10">{frDay(days[i].day)}</text>
        ))}
      </svg>
    </figure>
  );
}

export default async function MetricsPage() {
  const user = await getCurrentUser();
  // Page inexistante pour qui n'est pas administrateur : on ne révèle pas son existence.
  if (!user?.isAdmin) notFound();
  const [cohorts, split, rooms, usage] = await Promise.all([connectionCohorts(8), activitySplit(), roomsActivity(), usageDashboard(30)]);
  const { overview: o, ai } = usage;
  const actions = new Map(usage.actions.map((a) => [a.kind, a]));
  const games = usage.games.filter((g) => g.plays > 0);

  return (
    <div className="wide-page max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">Statistiques d’utilisation</h1>
        <p className="mt-1 text-soft">
          Chiffres agrégés sur les membres connectés, hors agent éditorial. Aucun contenu de conversation n’est lu pour les calculer.
          Les visiteurs non connectés ne sont pas comptés : Valyo n’a pas d’outil de mesure d’audience.
        </p>
      </div>

      <section aria-label="Vue d’ensemble" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Membres inscrits" value={o.members} note={`${o.new_7d} nouveau${o.new_7d > 1 ? "x" : ""} sur 7 jours`} delta={o.new_7d - o.new_prev_7d} />
        <Tile label="Actifs aujourd’hui" value={o.active_today} note={`${pct(o.active_today, o.members)} des membres`} />
        <Tile label="Actifs sur 7 jours" value={o.active_7d} note={`${pct(o.active_7d, o.members)} des membres`} delta={o.active_7d - o.active_prev_7d} />
        <Tile label="Actifs sur 30 jours" value={o.active_30d} note={`${pct(o.active_30d, o.members)} des membres`} />
      </section>

      <section className="card p-5" aria-labelledby="jours-titre">
        <h2 id="jours-titre" className="text-lg font-bold">Jour par jour, sur 30 jours</h2>
        <p className="mt-1 text-sm text-soft">
          <strong>Actif</strong> : membre connecté qui a ouvert Valyo ce jour-là. <strong>Action</strong> : publication, commentaire, réaction,
          relais, message, abonnement, partie de jeu ou synthèse demandée. Jours en temps universel (UTC).
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <DailyBars title="Membres actifs par jour" unit="actifs" days={usage.daily} pick={(d) => d.active} />
          <DailyBars title="Actions de membres par jour" unit="actions" days={usage.daily} pick={(d) => d.actions} />
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-soft">Voir le tableau jour par jour</summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full min-w-[22rem] text-left">
              <thead className="border-b border-line text-soft"><tr><th scope="col" className="py-1.5 pr-3">Jour</th><th scope="col" className="py-1.5 pr-3">Actifs</th><th scope="col" className="py-1.5 pr-3">Inscriptions</th><th scope="col" className="py-1.5 pr-3">Actions</th></tr></thead>
              <tbody>
                {[...usage.daily].reverse().map((d) => (
                  <tr key={d.day} className="border-b border-line last:border-0">
                    <th scope="row" className="py-1.5 pr-3 font-mono text-xs font-medium">{frDay(d.day)}</th>
                    <td className="py-1.5 pr-3">{d.active}</td><td className="py-1.5 pr-3">{d.signups}</td><td className="py-1.5 pr-3">{d.actions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="card p-5" aria-labelledby="actions-titre">
        <h2 id="actions-titre" className="text-lg font-bold">Ce que font les membres</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-left text-sm">
            <thead className="border-b border-line text-soft">
              <tr><th scope="col" className="py-2 pr-3">Action</th><th scope="col" className="py-2 pr-3">7 jours</th><th scope="col" className="py-2 pr-3">30 jours</th><th scope="col" className="py-2 pr-3">Membres différents (30 j)</th></tr>
            </thead>
            <tbody>
              {ACTION_LABELS.map(([kind, label]) => {
                const a = actions.get(kind);
                return (
                  <tr key={kind} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-3 font-medium">{label}</th>
                    <td className="py-2 pr-3">{a?.d7 ?? 0}</td><td className="py-2 pr-3 font-semibold">{a?.d30 ?? 0}</td><td className="py-2 pr-3">{a?.members_30d ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-soft">Notifications push activées par {o.push_members} membre{o.push_members > 1 ? "s" : ""}. Les messages privés sont seulement comptés, jamais lus.</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="jeux-titre">
          <h2 id="jeux-titre" className="text-lg font-bold">Jeux (30 jours)</h2>
          <p className="mt-1 text-sm text-soft">Parties de membres connectés qui ont compté pour des points : une par jeu et par jour.</p>
          {games.length === 0 ? <p className="mt-3 text-sm text-soft">Aucune partie comptée sur la période.</p> : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-line text-soft"><tr><th scope="col" className="py-2 pr-3">Jeu</th><th scope="col" className="whitespace-nowrap py-2 pr-3">Parties</th><th scope="col" className="whitespace-nowrap py-2 pr-3">Joueurs</th><th scope="col" className="whitespace-nowrap py-2 pr-3">Réussite</th></tr></thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.game} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-3 font-medium">{GAME_LABELS[g.game] ?? g.game}</th>
                    <td className="py-2 pr-3 font-semibold">{g.plays}</td><td className="py-2 pr-3">{g.players}</td><td className="py-2 pr-3">{g.success === null ? "—" : `${g.success} %`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card p-5" aria-labelledby="ia-titre">
          <h2 id="ia-titre" className="text-lg font-bold">IA et voix (30 jours)</h2>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
            <dt className="text-soft">Synthèses d’articles générées</dt><dd className="font-semibold">{ai.syntheses}</dd>
            <dt className="text-soft">Coût estimé des synthèses</dt><dd className="font-semibold">{money(ai.syntheses_micros)}</dd>
            <dt className="text-soft">Coût estimé des quiz de la semaine</dt><dd className="font-semibold">{money(ai.quiz_micros)}</dd>
            <dt className="text-soft">Lectures audio générées</dt><dd className="font-semibold">{ai.audio}</dd>
            <dt className="text-soft">Caractères lus à voix haute</dt><dd className="font-semibold">{new Intl.NumberFormat("fr-FR").format(ai.audio_chars)}</dd>
          </dl>
          <p className="mt-3 text-sm text-soft">Coûts estimés d’après les jetons consommés, en dollars ; la facture réelle est chez Anthropic. La voix est facturée par OpenAI et n’est pas chiffrée ici.</p>
        </section>
      </div>

      <section className="card p-5" aria-labelledby="themes-titre">
        <h2 id="themes-titre" className="text-lg font-bold">Thèmes</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-left text-sm">
            <thead className="border-b border-line text-soft">
              <tr><th scope="col" className="py-2 pr-3">Thème</th><th scope="col" className="py-2 pr-3">Abonnés</th><th scope="col" className="py-2 pr-3">Articles (7 j)</th><th scope="col" className="py-2 pr-3">Réactions et commentaires (30 j)</th></tr>
            </thead>
            <tbody>
              {usage.themes.map((t) => (
                <tr key={t.name} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 pr-3 font-medium">{t.name}</th>
                  <td className="py-2 pr-3">{t.followers}</td><td className="py-2 pr-3">{t.posts_7d}</td><td className="py-2 pr-3 font-semibold">{t.engagement_30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5" aria-labelledby="top-titre">
        <h2 id="top-titre" className="text-lg font-bold">Publications qui ont le plus fait réagir (30 jours)</h2>
        {usage.topPosts.every((p) => p.reactions + p.comments === 0) ? <p className="mt-3 text-sm text-soft">Aucune réaction ni commentaire de membre sur la période.</p> : (
          <ol className="mt-3 space-y-2 text-sm">
            {usage.topPosts.filter((p) => p.reactions + p.comments > 0).map((p, i) => (
              <li key={p.id} className="flex items-baseline gap-3">
                <span className="w-5 shrink-0 font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1"><Link href={`/p/${p.id}`} className="font-medium hover:text-accent">{p.title}</Link>{p.source_name && <span className="text-muted"> · {p.source_name}</span>}</span>
                <span className="shrink-0 whitespace-nowrap text-soft">{p.reactions} réaction{p.reactions > 1 ? "s" : ""} · {p.comments} commentaire{p.comments > 1 ? "s" : ""}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card p-5" aria-labelledby="liens-titre">
        <h2 id="liens-titre" className="text-lg font-bold">
          Fidélité : nouveaux membres reliés et revenus
        </h2>
        <p className="mt-1 text-sm text-soft">
          Par semaine d’inscription. <strong>Relié</strong> : a échangé avec un autre humain dans ses 7 premiers jours (les échanges avec l’agent
          éditorial ne comptent pas). <strong>Revenu</strong> : actif entre le 8e et le 14e jour.
        </p>
        {cohorts.length === 0 ? (
          <p className="mt-4 text-soft">Aucune inscription sur les 8 dernières semaines.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-line text-soft">
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
        <p className="mt-3 text-sm text-soft">« En cours » : les 14 jours de suivi ne sont pas écoulés, le chiffre peut encore monter.</p>
      </section>

      <section className="card p-5" aria-labelledby="activite-titre">
        <h2 id="activite-titre" className="text-lg font-bold">
          7 derniers jours
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <dt className="text-soft">Membres actifs</dt>
          <dd className="font-semibold">{split.weekly_active_members}</dd>
          <dt className="text-soft">Publications de membres</dt>
          <dd className="font-semibold">{split.human_posts}</dd>
          <dt className="text-soft">Publications de l’agent éditorial</dt>
          <dd className="font-semibold">{split.agent_posts}</dd>
          <dt className="text-soft">Commentaires de membres</dt>
          <dd className="font-semibold">{split.human_comments}</dd>
          <dt className="text-soft">Publications ayant reçu une réponse d’un autre membre</dt>
          <dd className="font-semibold">
            {split.posts_with_human_reply} sur {split.published_posts} ({pct(split.posts_with_human_reply, split.published_posts)})
          </dd>
        </dl>
      </section>

      <section className="card p-5" aria-labelledby="salons-titre">
        <h2 id="salons-titre" className="text-lg font-bold">Salons et chat (7 derniers jours)</h2>
        <p className="mt-1 text-sm text-soft">
          Agrégats uniquement : aucun contenu de conversation n’est lu, et les totaux ne distinguent pas les salons privés des publics.
          Lecture (adhésion, suivi) et contribution (écriture) sont séparées.
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <dt className="text-soft">Salons actifs (non archivés)</dt>
          <dd className="font-semibold">{rooms.active_rooms}</dd>
          <dt className="text-soft">Salons créés</dt>
          <dd className="font-semibold">{rooms.rooms_created}</dd>
          <dt className="text-soft">Salons avec au moins un message</dt>
          <dd className="font-semibold">{rooms.rooms_with_activity} sur {rooms.active_rooms} ({pct(rooms.rooms_with_activity, rooms.active_rooms)})</dd>
          <dt className="text-soft">Messages envoyés</dt>
          <dd className="font-semibold">{rooms.messages}</dd>
          <dt className="text-soft">Membres ayant écrit (contribution)</dt>
          <dd className="font-semibold">{rooms.writers}</dd>
          <dt className="text-soft">Membres d’au moins un salon (lecture)</dt>
          <dd className="font-semibold">{rooms.members}, dont {rooms.followers} suiveur{rooms.followers > 1 ? "s" : ""}</dd>
        </dl>
      </section>
    </div>
  );
}
