// Shorts quotidiens : choix des trois articles, anti-doublon, contrôle du script, préparation rejouable.
import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareShort, shortsAuthorized } from "../lib/shorts/runs.ts";
import { buildScript, CTA, MAX_SPOKEN_WORDS, type ShortWriter } from "../lib/shorts/script.ts";
import { pickThree, selectShort, type ShortCandidate } from "../lib/shorts/selection.ts";
import { createTestDb } from "./editorial-helpers.ts";

const NOW = new Date("2026-11-27T08:00:00Z");
const draft = {
  hook: "Trois découvertes qui changent la donne ce matin",
  news: [1, 2, 3].map((i) => ({ carte: `Carte numéro ${i} du jour`, phrase: `Voici la nouvelle numéro ${i}, racontée simplement avec les faits de l'article et rien d'autre du tout.` })),
  question: "Laquelle de ces trois avancées te semble la plus utile ?",
  titre: "Les 3 news science et IA du jour",
  tags: ["Science", "#IA"],
};
const writer = (calls: { n: number }): ShortWriter => ({ async write() { calls.n++; return { draft, costMicros: 420 }; } });

async function seed() {
  const { db } = await createTestDb();
  const [{ id: agent }] = await db.query<{ id: string }>(`SELECT id FROM users WHERE handle = 'valyo-actus'`);
  const themes = await db.query<{ id: string; slug: string }>(`SELECT id, slug FROM themes ORDER BY position LIMIT 4`);
  const body = "Un texte d'article assez long pour servir de matière au script du jour. ".repeat(4);
  const post = async (title: string, hoursAgo: number, theme: number, source: string | null = "Source Test") => {
    const [{ id }] = await db.query<{ id: string }>(
      `INSERT INTO posts (author_id, kind, title, body, status, source_name, created_at) VALUES ($1, 'news', $2, $3, 'published', $4, $5::timestamptz - ($6::int * interval '1 hour')) RETURNING id`,
      [agent, title, body, source, NOW.toISOString(), hoursAgo],
    );
    await db.query(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [id, themes[theme].id]);
    return id;
  };
  return { db, post, themes };
}

test("choix : articles de presse récents, thèmes variés, réclames et textes de membres écartés", async () => {
  const { db, post } = await seed();
  const a = await post("Une découverte en astronomie", 2, 0);
  const b = await post("Une autre découverte du même thème", 3, 0);
  const c = await post("Une avancée en robotique", 4, 1);
  const d = await post("Un résultat en biologie", 5, 2);
  await post("Ce casque audio passe à 49 euros seulement", 1, 3);
  await post("Publication d'un membre", 1, 3, null);
  await post("Article trop vieux", 100, 3);
  const picked = await selectShort(db.query, NOW);
  assert.deepEqual(picked.map((p) => p.postId), [a, c, d], "un thème par article ; le doublon de thème, la réclame, le texte de membre et le vieil article restent dehors");
  assert.ok(!picked.some((p) => p.postId === b));
});

test("pickThree complète avec un thème déjà pris quand il n'y a pas trois thèmes", () => {
  const c = (id: string, slug: string): ShortCandidate => ({ postId: id, title: id, source: "S", theme: slug, themeSlug: slug, text: "x", score: 0 });
  assert.deepEqual(pickThree([c("1", "ia"), c("2", "ia"), c("3", "espace"), c("4", "ia")]).map((p) => p.postId), ["1", "3", "2"]);
  assert.equal(pickThree([c("1", "ia")]).length, 1);
});

test("préparation : enregistrée une fois par jour, rejouable sans nouvel appel, articles jamais réutilisés", async () => {
  const { db, post } = await seed();
  for (let i = 0; i < 7; i++) await post(`Article numéro ${i}`, 2 + i, i % 4);
  const calls = { n: 0 };
  const deps = { q: db.query, writer: writer(calls), now: NOW, siteUrl: "https://www.valyo.si" };

  const essai = await prepareShort({ ...deps, day: "2026-11-27", dryRun: true });
  assert.ok(essai && !essai.recorded);
  assert.equal((await db.query(`SELECT 1 FROM short_runs`)).length, 0, "un essai n'enregistre rien");

  const first = await prepareShort({ ...deps, day: "2026-11-27", dryRun: false });
  const again = await prepareShort({ ...deps, day: "2026-11-27", dryRun: false });
  assert.deepEqual(again, first);
  assert.equal(calls.n, 2, "le second passage du jour ne rappelle pas le modèle");
  assert.deepEqual(first!.items.map((i) => i.postId), essai!.items.map((i) => i.postId));

  const next = await prepareShort({ ...deps, day: "2026-11-28", dryRun: false });
  assert.ok(next);
  assert.equal(new Set([...first!.items, ...next!.items].map((i) => i.postId)).size, 6, "aucun article repris d'un jour à l'autre");
  assert.equal(await prepareShort({ ...deps, day: "2026-11-29", dryRun: false }), null, "il ne reste qu'un article : pas de Short");
});

test("script : appel final et #Shorts imposés par le code, sources dans la description, longueur bornée", () => {
  const picked: ShortCandidate[] = [1, 2, 3].map((i) => ({ postId: `id-${i}`, title: `T${i}`, source: `Source ${i}`, theme: "IA", themeSlug: "ia", text: "x", score: 0 }));
  const s = buildScript(draft, picked, "https://www.valyo.si");
  assert.equal(s.cta, CTA);
  assert.ok(s.youtubeTitle.endsWith("#Shorts") && s.youtubeTitle.length <= 70);
  for (const p of picked) assert.ok(s.description.includes(p.source) && s.description.includes(`/p/${p.postId}`));
  assert.ok(s.description.includes("voix de synthèse"));
  assert.ok(s.tags.includes("ia") && !s.tags.some((t) => t.startsWith("#")));
  assert.throws(() => buildScript({ ...draft, news: draft.news.slice(0, 2) }, picked, "https://x"), /incomplet/);
  const bavard = draft.news.map((n) => ({ ...n, phrase: Array(Math.ceil(MAX_SPOKEN_WORDS / 2)).fill("mot").join(" ") }));
  assert.throws(() => buildScript({ ...draft, news: bavard }, picked, "https://x"), /trop long/);
  assert.throws(() => buildScript({ ...draft, question: "Va voir https://piege.example tout de suite ?" }, picked, "https://x"), /adresse web/);
});

test("jeton de l'automate : refusé s'il manque, s'il est faux ou si le serveur n'en a pas", () => {
  const req = (token?: string) => new Request("https://x/api/shorts/preparer", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });
  const token = "a".repeat(40);
  process.env.VALYO_SHORTS_TOKEN = token;
  assert.equal(shortsAuthorized(req(token)), true);
  assert.equal(shortsAuthorized(req("b".repeat(40))), false);
  assert.equal(shortsAuthorized(req()), false);
  process.env.VALYO_SHORTS_TOKEN = "";
  assert.equal(shortsAuthorized(req("")), false);
});
