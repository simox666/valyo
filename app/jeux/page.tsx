import type { Metadata } from "next";
import Link from "next/link";
import { SIMULATORS } from "@/lib/simulateurs/catalogue.ts";
import { Avatar } from "@/components/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listActiveThemes } from "@/lib/data/themes";
import { loadWeeklyQuiz, weeklyResult } from "@/lib/jeux/hebdo.ts";
import { WEEKLY_POINTS, DAILY_PERFECT_BONUS, DAILY_POINTS, FREE_MAX, STREAK_BONUS, STREAK_EVERY, dailyResult, dailyStats, leaderboard, parisDay, playerCount, standing, weekStart, type Ranked } from "@/lib/jeux/points.ts";
import { themesWithGames } from "@/lib/jeux/questions";
import { GamesClient } from "./GamesClient";

export const metadata: Metadata = {
  title: "Jeux",
  description: "Défi du jour, quiz de la semaine sur l’actualité, quiz par thème, et des jeux visuels : placer un objet sur une règle des grandeurs, dessiner une courbe, ranger une frise. Marquez des points et grimpez au classement.",
  // /jeux?theme=… ouvre le quiz d'un thème : une seule adresse canonique.
  alternates: { canonical: "/jeux" },
};

/** En dessous de ce nombre de joueurs, le classement n'est pas affiché : une liste d'un ou deux noms donne l'image d'un site désert. */
const MIN_PLAYERS_FOR_BOARD = 5;

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
  const [week, allTime, myWeek, myAllTime, played, players, stats] = await Promise.all([
    leaderboard(db.query, monday),
    leaderboard(db.query, null),
    member ? standing(db.query, member.id, monday) : null,
    member ? standing(db.query, member.id, null) : null,
    member ? dailyResult(db.query, member.id, day) : null,
    playerCount(db.query),
    dailyStats(db.query, day),
  ]);
  const weeklyQuestions = await loadWeeklyQuiz(db.query, monday);
  const weekly = weeklyQuestions
    ? { week: monday, questions: weeklyQuestions, played: member ? await weeklyResult(db.query, member.id, monday) : null }
    : null;
  const showBoard = players >= MIN_PLAYERS_FOR_BOARD;
  // Graine de la manche ouverte par /jeux?theme=… : tirée ici, pour que le navigateur affiche les mêmes questions.
  const initialSeed = Math.random().toString(36).slice(2, 12);

  return (
    <div className="space-y-5">
      <header>
        <p className="label-mono text-accent">Pour s’amuser</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-[28px]">Jeux</h1>
        <p className="mt-1 text-soft">
          Deux familles : des questions de culture générale, et des jeux où l’on place, trace et glisse.
          Chaque réponse vient avec son explication.
        </p>
      </header>
      <GamesClient themes={themes} initialTheme={initialTheme} initialSeed={initialSeed} day={day} dayLabel={dayLabel} isMember={Boolean(member)} serverDaily={played} weekly={weekly} />

      <Link href="/simulateurs" className="card flex items-center justify-between gap-4 p-5 hover:ring-accent sm:p-6">
        <span className="min-w-0">
          <span className="label-mono block text-accent">Simulateurs · {SIMULATORS.length} à essayer</span>
          <span className="mt-1 block font-display text-lg font-bold">Manipuler pour comprendre</span>
          <span className="mt-1 block text-sm text-soft">Mise en orbite, épidémie, climat, réseau de neurones, créature d’une autre planète…</span>
        </span>
        <span aria-hidden className="shrink-0 text-sm font-semibold text-accent">Voir →</span>
      </Link>

      <section id="classement" className="card p-5 sm:p-6">
        <p className="label-mono text-accent">Classement des Valyors</p>
        <h2 className="mt-1 text-lg font-bold">{showBoard ? "Qui mène la danse ?" : "Comment marquer des points"}</h2>
        <ul className="mt-2 space-y-1 text-sm text-soft">
          <li><strong className="text-ink">Défi du jour</strong> : {DAILY_POINTS} points par bonne réponse, +{DAILY_PERFECT_BONUS} pour un sans-faute.</li>
          <li><strong className="text-ink">Série</strong> : +{STREAK_BONUS} points tous les {STREAK_EVERY} défis joués d’affilée.</li>
          <li><strong className="text-ink">Quiz de la semaine</strong> : {WEEKLY_POINTS} points par bonne réponse, une fois par semaine.</li>
          <li><strong className="text-ink">Autres jeux</strong> : jusqu’à {FREE_MAX} points par partie, une fois par jour pour chaque jeu et pour chaque thème de quiz.</li>
        </ul>
        {stats && (
          <p className="mt-3 text-sm">
            Défi du {dayLabel} : {stats.players} {stats.players > 1 ? "Valyors ont joué" : "Valyor a joué"}, score moyen {stats.average.toFixed(1).replace(".", ",")} / 7.
          </p>
        )}
        {!member && (
          <p className="mt-3 rounded-lg bg-chip px-3 py-2 text-sm">
            <Link href="/connexion?next=/jeux" className="btn-link">Connectez-vous</Link> pour marquer des points et entrer au classement.
          </p>
        )}
        {showBoard ? (
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <Board title="Cette semaine" rows={week} mine={myWeek} me={member?.handle ?? null} empty="Personne n’a encore marqué cette semaine : à vous d’ouvrir le score." />
            <Board title="Depuis toujours" rows={allTime} mine={myAllTime} me={member?.handle ?? null} empty="Le classement démarre avec la première partie." />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {myAllTime ? `Vous avez ${myAllTime.points} points. ` : ""}Le classement s’affichera dès que {MIN_PLAYERS_FOR_BOARD} Valyors auront marqué des points.
          </p>
        )}
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
