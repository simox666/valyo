import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listActiveThemes } from "@/lib/data/themes";
import { DAILY_PERFECT_BONUS, DAILY_POINTS, FREE_POINTS, dailyResult, leaderboard, parisDay, standing, weekStart, type Ranked } from "@/lib/jeux/points.ts";
import { themesWithGames } from "@/lib/jeux/questions";
import { GamesClient } from "./GamesClient";

export const metadata: Metadata = {
  title: "Jeux",
  description: "Défi du jour, quiz, vrai ou faux, ordres de grandeur et frises chronologiques sur les thèmes de Valyo.",
};

/**
 * Jeux liés aux thèmes : jouables par tous, sans compte. Un membre connecté marque des
 * points (notés par le serveur) et figure au classement des Valyors.
 */
export default async function GamesPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const playable = themesWithGames();
  const themes = (await listActiveThemes())
    .filter((t) => playable.has(t.slug))
    .map((t) => ({ slug: t.slug, name: t.name }));
  const asked = (await searchParams).theme;
  const initialTheme = asked && themes.some((t) => t.slug === asked) ? asked : null;

  // Le jour du défi est celui de Paris, fixé ici : serveur et navigateur tirent les mêmes questions.
  const day = parisDay();
  const dayLabel = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" }).format(new Date());
  const monday = weekStart(day);

  const user = await getCurrentUser();
  const member = user?.onboarded && user.status === "active" ? user : null;
  const [week, allTime, myWeek, myAllTime, played] = await Promise.all([
    leaderboard(db.query, monday),
    leaderboard(db.query, null),
    member ? standing(db.query, member.id, monday) : null,
    member ? standing(db.query, member.id, null) : null,
    member ? dailyResult(db.query, member.id, day) : null,
  ]);

  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <header>
        <p className="label-mono text-accent">Pour s’amuser</p>
        <h1 className="mt-1 text-2xl font-bold">Jeux</h1>
        <p className="mt-1 text-soft">
          Testez vos connaissances sur les thèmes de Valyo. Chaque réponse vient avec une
          explication — de quoi briller ensuite dans les salons.
        </p>
      </header>
      <GamesClient themes={themes} initialTheme={initialTheme} day={day} dayLabel={dayLabel} isMember={Boolean(member)} serverDaily={played} />

      <section id="classement" className="card p-5 sm:p-6">
        <p className="label-mono text-accent">Classement des Valyors</p>
        <h2 className="mt-1 text-lg font-extrabold">Qui mène la danse ?</h2>
        <p className="mt-1 text-sm text-soft">
          Défi du jour : {DAILY_POINTS} points par bonne réponse, +{DAILY_PERFECT_BONUS} pour un sans-faute. Autres jeux : {FREE_POINTS} points
          par bonne réponse. Seule la première partie du jour de chaque jeu compte.
        </p>
        {!member && (
          <p className="mt-3 rounded-lg bg-chip px-3 py-2 text-sm">
            <Link href="/connexion?next=/jeux" className="btn-link">Connectez-vous</Link> pour marquer des points et entrer au classement.
          </p>
        )}
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <Board title="Cette semaine" rows={week} mine={myWeek} me={member?.handle ?? null} empty="Personne n’a encore marqué cette semaine : à vous d’ouvrir le score." />
          <Board title="Depuis toujours" rows={allTime} mine={myAllTime} me={member?.handle ?? null} empty="Le classement démarre avec la première partie." />
        </div>
      </section>
    </div>
  );
}

function Board({ title, rows, mine, me, empty }: { title: string; rows: Ranked[]; mine: { points: number; rank: number } | null; me: string | null; empty: string }) {
  const listed = me !== null && rows.some((r) => r.handle === me);
  return (
    <div>
      <h3 className="label-mono">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.handle} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${r.handle === me ? "bg-accent-soft font-semibold" : ""}`}>
              <span className="w-5 shrink-0 text-right font-mono text-xs text-muted">{r.rank}</span>
              <Avatar name={r.displayName} seed={r.handle} size="xs" imageId={r.avatarId} />
              <Link href={`/m/${r.handle}`} className="min-w-0 flex-1 truncate hover:underline">{r.displayName}</Link>
              <span className="shrink-0 font-mono text-xs font-semibold">{r.points} pts</span>
            </li>
          ))}
        </ol>
      )}
      {me !== null && mine && !listed && (
        <p className="mt-2 border-t border-line pt-2 text-sm">Vous : {mine.rank}ᵉ avec {mine.points} pts</p>
      )}
    </div>
  );
}
