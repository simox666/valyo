import type { Query } from "../editorial/types.ts";

// Progression d'un membre (gamification « Carnet de labo »). Règle d'or : on progresse par ce
// que LES AUTRES font de ses contributions (réactions, réponses, salons rejoints), jamais par
// le volume publié. Uniquement des données publiques, comme le reste du profil.
//
// - Tableau périodique : chaque thème est un élément. Découvert à la première contribution
//   (Curieux), puis Initié et Référent selon les points de reconnaissance reçus dans ce thème.
// - Découvertes : paliers rares, acquis pour toujours.
// - Série : semaines consécutives (lundi-dimanche, heure de Bruxelles) avec au moins une
//   activité : publication, commentaire, réaction ou message de salon.

export const LEVELS = [
  { level: 1, name: "Curieux", points: 0 },
  { level: 2, name: "Initié", points: 5 },
  { level: 3, name: "Référent", points: 20 },
] as const;

export const levelName = (level: number) => LEVELS.find((l) => l.level === level)?.name ?? "Non découvert";

/** Niveau atteint : 0 sans contribution dans le thème, sinon selon les points reçus. */
export function levelFor(contributions: number, points: number): number {
  if (contributions <= 0 && points <= 0) return 0;
  return [...LEVELS].reverse().find((l) => points >= l.points)!.level;
}

export interface Badge {
  key: string;
  symbol: string;
  name: string;
  how: string;
  target: number;
}

export const BADGES: Badge[] = [
  { key: "premier_pas", symbol: "Pp", name: "Premier pas", how: "Publier ou commenter pour la première fois", target: 1 },
  { key: "pionnier", symbol: "Pi", name: "Pionnier", how: "Partager un sujet que 5 membres veulent creuser", target: 5 },
  { key: "vulgarisateur", symbol: "Vu", name: "Vulgarisateur", how: "Une publication qui a fait apprendre 5 membres", target: 5 },
  { key: "catalyseur", symbol: "Ca", name: "Catalyseur", how: "Créer un salon qui réunit 5 membres", target: 5 },
  { key: "mentor", symbol: "Me", name: "Mentor", how: "Répondre aux questions de 10 publications", target: 10 },
  { key: "explorateur", symbol: "Ex", name: "Explorateur", how: "Contribuer dans 5 thèmes différents", target: 5 },
  { key: "polymathe", symbol: "Po", name: "Polymathe", how: "Être Initié dans 3 thèmes", target: 3 },
  { key: "fidele", symbol: "Fi", name: "Fidèle", how: "4 semaines d’activité d’affilée", target: 4 },
];

export interface ThemeProgress {
  slug: string;
  name: string;
  contributions: number;
  points: number;
  level: number;
  /** Points manquants avant le niveau suivant (null au niveau maximal ou non découvert). */
  toNext: number | null;
}

export interface Progress {
  themes: ThemeProgress[];
  badges: (Badge & { value: number; unlocked: boolean; unlockedAt: string | null })[];
  streak: { current: number; best: number; activeThisWeek: boolean };
}

/** Lundi (AAAA-MM-JJ) de la semaine d'une date, heure de Bruxelles. */
export function weekOf(date: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(date);
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const shiftWeek = (week: string, n: number) => {
  const d = new Date(`${week}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
};

/**
 * Série en cours et record à partir des semaines actives (lundis). Une semaine en cours encore
 * vide ne casse pas la série : elle reste à prolonger jusqu'à dimanche soir.
 */
export function weekStreak(weeks: string[], today = new Date()) {
  const set = new Set(weeks);
  const thisWeek = weekOf(today);
  const activeThisWeek = set.has(thisWeek);
  let current = 0;
  for (let w = activeThisWeek ? thisWeek : shiftWeek(thisWeek, -1); set.has(w); w = shiftWeek(w, -1)) current++;
  let best = 0;
  for (const w of set) {
    if (set.has(shiftWeek(w, -1))) continue; // pas le début d'une série
    let n = 0;
    for (let x = w; set.has(x); x = shiftWeek(x, 1)) n++;
    best = Math.max(best, n);
  }
  return { current, best: Math.max(best, current), activeThisWeek };
}

export async function computeProgress(q: Query, memberId: string, today = new Date()): Promise<Progress> {
  const [themes, scores, contributions, [counts], weeks] = await Promise.all([
    q<{ slug: string; name: string }>(`SELECT slug, name FROM themes WHERE active ORDER BY position`),
    q<{ slug: string; points: number }>(
      `WITH mine AS (
         SELECT p.id, pt.theme_id FROM posts p JOIN post_themes pt ON pt.post_id = p.id
         WHERE p.author_id = $1 AND p.status = 'published'
       )
       SELECT t.slug, sum(x.pts)::int AS points FROM (
         -- Réactions des autres sur ses publications (« J'ai appris » vaut double).
         SELECT m.theme_id, CASE r.kind WHEN 'appris' THEN 2 ELSE 1 END AS pts
           FROM mine m JOIN post_reactions r ON r.post_id = m.id AND r.user_id <> $1
         UNION ALL
         -- Membres distincts venus en discuter sous ses publications.
         SELECT m.theme_id, 1 FROM mine m
           JOIN (SELECT DISTINCT post_id, author_id FROM comments WHERE status = 'published' AND author_id <> $1) c ON c.post_id = m.id
         UNION ALL
         -- Réponses reçues à ses commentaires.
         SELECT pt.theme_id, 1 FROM comments mc
           JOIN comments r ON r.parent_id = mc.id AND r.status = 'published' AND r.author_id <> $1
           JOIN posts p ON p.id = mc.post_id AND p.status = 'published'
           JOIN post_themes pt ON pt.post_id = p.id
           WHERE mc.author_id = $1 AND mc.status = 'published'
         UNION ALL
         -- Relais de ses publications par d'autres membres (diffusion = reconnaissance).
         SELECT m.theme_id, 2 FROM mine m JOIN post_relays pr ON pr.post_id = m.id AND pr.user_id <> $1
         UNION ALL
         -- Réponses retenues comme meilleure réponse d'une question (forte reconnaissance).
         SELECT pt.theme_id, 3 FROM posts p
           JOIN comments c ON c.id = p.best_comment_id AND c.author_id = $1
           JOIN post_themes pt ON pt.post_id = p.id
           WHERE p.status = 'published' AND p.author_id <> $1
         UNION ALL
         -- Questions des autres auxquelles il a répondu (une fois par question).
         SELECT pt.theme_id, 1 FROM (
           SELECT DISTINCT c.post_id FROM comments c JOIN posts p ON p.id = c.post_id
           WHERE c.author_id = $1 AND c.status = 'published' AND p.status = 'published' AND p.kind = 'question' AND p.author_id <> $1
         ) qa JOIN post_themes pt ON pt.post_id = qa.post_id
       ) x JOIN themes t ON t.id = x.theme_id GROUP BY t.slug`,
      [memberId],
    ),
    q<{ slug: string; n: number }>(
      `SELECT t.slug, count(*)::int AS n FROM (
         SELECT pt.theme_id FROM posts p JOIN post_themes pt ON pt.post_id = p.id WHERE p.author_id = $1 AND p.status = 'published'
         UNION ALL
         SELECT pt.theme_id FROM comments c JOIN posts p ON p.id = c.post_id JOIN post_themes pt ON pt.post_id = p.id
           WHERE c.author_id = $1 AND c.status = 'published' AND p.status = 'published'
       ) x JOIN themes t ON t.id = x.theme_id GROUP BY t.slug`,
      [memberId],
    ),
    q<{ contributions: number; dig: number; taught: number; room: number; answered: number }>(
      `SELECT
         (SELECT count(*)::int FROM posts WHERE author_id = $1 AND status = 'published')
           + (SELECT count(*)::int FROM comments WHERE author_id = $1 AND status = 'published') AS contributions,
         COALESCE((SELECT max(n) FROM (SELECT count(*)::int AS n FROM post_reactions r JOIN posts p ON p.id = r.post_id
            WHERE p.author_id = $1 AND p.status = 'published' AND r.kind = 'a_creuser' AND r.user_id <> $1 GROUP BY r.post_id) s), 0) AS dig,
         COALESCE((SELECT max(n) FROM (SELECT count(*)::int AS n FROM post_reactions r JOIN posts p ON p.id = r.post_id
            WHERE p.author_id = $1 AND p.status = 'published' AND r.kind = 'appris' AND r.user_id <> $1 GROUP BY r.post_id) s), 0) AS taught,
         COALESCE((SELECT max(n) FROM (SELECT count(*)::int AS n FROM room_members o JOIN room_members m ON m.room_id = o.room_id
            JOIN rooms r ON r.id = o.room_id WHERE o.user_id = $1 AND o.role = 'owner' AND r.archived_at IS NULL GROUP BY o.room_id) s), 0) AS room,
         (SELECT count(DISTINCT c.post_id)::int FROM comments c JOIN posts p ON p.id = c.post_id
            WHERE c.author_id = $1 AND c.status = 'published' AND p.status = 'published' AND p.kind = 'question' AND p.author_id <> $1) AS answered`,
      [memberId],
    ),
    q<{ w: string }>(
      `SELECT DISTINCT to_char(date_trunc('week', d), 'YYYY-MM-DD') AS w FROM (
         SELECT created_at AT TIME ZONE 'Europe/Brussels' AS d FROM posts WHERE author_id = $1 AND status = 'published'
         UNION ALL SELECT created_at AT TIME ZONE 'Europe/Brussels' FROM comments WHERE author_id = $1 AND status = 'published'
         UNION ALL SELECT created_at AT TIME ZONE 'Europe/Brussels' FROM post_reactions WHERE user_id = $1
         UNION ALL SELECT created_at AT TIME ZONE 'Europe/Brussels' FROM room_messages WHERE author_id = $1 AND deleted_at IS NULL
       ) x WHERE d > ($2::timestamptz AT TIME ZONE 'Europe/Brussels') - interval '3 years'`,
      [memberId, today.toISOString()],
    ),
  ]);

  const stored = await q<{ key: string; unlocked_at: Date | string }>(`SELECT key, unlocked_at FROM user_achievements WHERE user_id = $1`, [memberId]);
  const storedAt = new Map(stored.map((s) => [s.key, new Date(s.unlocked_at).toISOString()]));
  const pointsBy = new Map(scores.map((s) => [s.slug, Number(s.points)]));
  const contribBy = new Map(contributions.map((c) => [c.slug, Number(c.n)]));

  const themeProgress = themes.map((t): ThemeProgress => {
    const points = pointsBy.get(t.slug) ?? 0;
    const contributions = contribBy.get(t.slug) ?? 0;
    // Un niveau acquis ne se perd pas (réaction retirée, publication supprimée).
    const kept = [3, 2, 1].find((l) => storedAt.has(levelKey(t.slug, l))) ?? 0;
    const level = Math.max(levelFor(contributions, points), kept);
    const next = LEVELS.find((l) => l.level === level + 1);
    return { slug: t.slug, name: t.name, contributions, points, level, toNext: level > 0 && next ? Math.max(next.points - points, 1) : null };
  });

  const streak = weekStreak(weeks.map((w) => w.w), today);
  const c = counts ?? { contributions: 0, dig: 0, taught: 0, room: 0, answered: 0 };
  const values: Record<string, number> = {
    premier_pas: Number(c.contributions),
    pionnier: Number(c.dig),
    vulgarisateur: Number(c.taught),
    catalyseur: Number(c.room),
    mentor: Number(c.answered),
    explorateur: themeProgress.filter((t) => t.level >= 1).length,
    polymathe: themeProgress.filter((t) => t.level >= 2).length,
    fidele: streak.best,
  };
  const badges = BADGES.map((b) => {
    const value = values[b.key] ?? 0;
    const at = storedAt.get(badgeKey(b.key)) ?? null;
    return { ...b, value, unlocked: Boolean(at) || value >= b.target, unlockedAt: at };
  });
  return { themes: themeProgress, badges, streak };
}

const levelKey = (slug: string, level: number) => `niveau:${slug}:${level}`;
const badgeKey = (key: string) => `badge:${key}`;

/** Clés de paliers atteints selon la progression calculée. */
export function achievedKeys(p: Progress): string[] {
  const keys: string[] = [];
  for (const t of p.themes) for (let l = 1; l <= t.level; l++) keys.push(levelKey(t.slug, l));
  for (const b of p.badges) if (b.unlocked) keys.push(badgeKey(b.key));
  return keys;
}

export interface Unlock {
  key: string;
  kind: "element" | "niveau" | "badge";
  symbol: string;
  title: string;
  detail: string;
  slug?: string;
}

/** Texte d'un palier pour le toast. */
export function describeUnlock(key: string, p: Progress): Unlock | null {
  const [kind, a, b] = key.split(":");
  if (kind === "niveau") {
    const theme = p.themes.find((t) => t.slug === a);
    if (!theme) return null;
    const level = Number(b);
    return level === 1
      ? { key, kind: "element", symbol: "", slug: a, title: `Nouvel élément : ${theme.name}`, detail: "Votre première contribution dans ce thème. Niveau Curieux." }
      : { key, kind: "niveau", symbol: "", slug: a, title: `${levelName(level)} en ${theme.name}`, detail: level === 3 ? "Vos contributions font référence pour les autres membres." : "Les autres membres apprécient vos contributions dans ce thème." };
  }
  if (kind === "badge") {
    const badge = BADGES.find((x) => x.key === a);
    return badge ? { key, kind: "badge", symbol: badge.symbol, title: `Découverte : ${badge.name}`, detail: badge.how } : null;
  }
  return null;
}

/**
 * Enregistre les paliers nouvellement atteints et renvoie ceux pas encore montrés.
 * Au tout premier calcul d'un membre, ce qu'il avait déjà mérité est enregistré comme vu.
 */
export async function syncProgress(q: Query, memberId: string, today = new Date()): Promise<{ progress: Progress; unseen: Unlock[] }> {
  const progress = await computeProgress(q, memberId, today);
  const [user] = await q<{ progress_synced_at: Date | null }>(`SELECT progress_synced_at FROM users WHERE id = $1`, [memberId]);
  if (!user) return { progress, unseen: [] };
  const first = !user.progress_synced_at;
  const keys = achievedKeys(progress);
  if (keys.length) {
    await q(
      `INSERT INTO user_achievements (user_id, key, seen_at)
       SELECT $1, k, CASE WHEN $3 THEN now() END FROM unnest($2::text[]) AS k
       ON CONFLICT (user_id, key) DO NOTHING`,
      [memberId, keys, first],
    );
  }
  if (first) await q(`UPDATE users SET progress_synced_at = now() WHERE id = $1`, [memberId]);
  const unseen = await q<{ key: string }>(
    `SELECT key FROM user_achievements WHERE user_id = $1 AND seen_at IS NULL ORDER BY unlocked_at, key LIMIT 5`,
    [memberId],
  );
  return { progress, unseen: unseen.map((u) => describeUnlock(u.key, progress)).filter((u): u is Unlock => Boolean(u)) };
}

export async function markSeen(q: Query, memberId: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  await q(`UPDATE user_achievements SET seen_at = now() WHERE user_id = $1 AND key = ANY($2::text[]) AND seen_at IS NULL`, [memberId, keys]);
}

/** Prochain objectif à afficher dans le menu : le thème le plus proche du niveau suivant. */
export function nextGoal(p: Progress): { label: string; detail: string } | null {
  const closest = p.themes.filter((t) => t.toNext !== null).sort((a, b) => a.toNext! - b.toNext! || b.points - a.points)[0];
  if (closest) {
    return { label: `${levelName(closest.level + 1)} en ${closest.name}`, detail: `encore ${closest.toNext} point${closest.toNext! > 1 ? "s" : ""}` };
  }
  const discovered = p.themes.filter((t) => t.level > 0).length;
  if (discovered === 0) return { label: "Découvrir votre premier élément", detail: "publiez ou commentez" };
  return null;
}
