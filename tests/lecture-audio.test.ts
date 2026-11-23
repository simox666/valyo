// Lecture audio par une voix naturelle : fabrication au premier appel, conservation ensuite,
// refabrication si le texte change, plafond quotidien, repli propre sans service. Aucun appel réseau.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), "valyo-lecture-"));

const { getOrCreateAudio, openAiVoice, requestChunks, spokenText, sweepLecture, MAX_SPOKEN_CHARS } = await import("../lib/lecture-audio.ts");
const { createTestDb } = await import("./editorial-helpers.ts");
type Db = Awaited<ReturnType<typeof createTestDb>>["db"];

async function addPost(db: Db) {
  const [u] = await db.query<{ id: string }>(`INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ($1, $2, 'Lecteur', now()) RETURNING id`, [`l-${Math.random()}@example.test`, `l_${Math.floor(Math.random() * 1e9)}`]);
  const [p] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body, status) VALUES ($1, 'news', 'Titre', 'Corps', 'published') RETURNING id`, [u.id]);
  return p.id;
}
const fakeVoice = () => {
  const calls: string[] = [];
  const voice = async (text: string, lang: "fr" | "en") => { calls.push(`${lang}:${text.length}`); return Buffer.alloc(400, calls.length); };
  return { calls, voice };
};
const TEXT = "Une sonde est entrée en orbite autour de Mercure. Elle y restera deux ans pour cartographier la planète.";

test("lecture audio : texte lu borné, découpé sans rien perdre", () => {
  assert.equal(spokenText("  Un   texte https://exemple.test/x propre.  "), "Un texte propre.");
  const long = "Phrase numéro un. ".repeat(900);
  const spoken = spokenText(long);
  assert.ok(spoken.length <= MAX_SPOKEN_CHARS && spoken.endsWith("."));
  const chunks = requestChunks(spoken);
  assert.ok(chunks.length >= 2 && chunks.every((c) => c.length <= 3800 && c.endsWith(".")));
  assert.equal(chunks.join(" "), spoken);
});

test("lecture audio : fabriqué une fois, puis resservi ; refait si le texte change", async () => {
  const { db } = await createTestDb();
  const postId = await addPost(db);
  const { calls, voice } = fakeVoice();
  const first = await getOrCreateAudio(db.query, { postId, kind: "synthese", text: TEXT, lang: "fr" }, voice);
  assert.ok(first.ok && first.created && existsSync(first.file));
  const again = await getOrCreateAudio(db.query, { postId, kind: "synthese", text: TEXT, lang: "fr" }, voice);
  assert.ok(again.ok && !again.created && again.file === first.file);
  assert.equal(calls.length, 1, "le service n'est appelé qu'une fois");
  // Sans service (pas de clé) : le son déjà fabriqué reste servi.
  assert.ok((await getOrCreateAudio(db.query, { postId, kind: "synthese", text: TEXT, lang: "fr" }, null)).ok);
  // Un autre type pour la même publication a son propre fichier.
  const article = await getOrCreateAudio(db.query, { postId, kind: "article", text: TEXT, lang: "fr" }, voice);
  assert.ok(article.ok && article.file !== first.file);
  // Texte modifié : nouveau son, l'ancien fichier disparaît.
  const changed = await getOrCreateAudio(db.query, { postId, kind: "synthese", text: `${TEXT} Une phrase de plus.`, lang: "fr" }, voice);
  assert.ok(changed.ok && changed.created && changed.file !== first.file && !existsSync(first.file));
  const rows = await db.query(`SELECT kind FROM post_audio WHERE post_id = $1`, [postId]);
  assert.equal(rows.length, 2);
});

test("lecture audio : deux écoutes simultanées ne paient qu'une fabrication", async () => {
  const { db } = await createTestDb();
  const postId = await addPost(db);
  const { calls, voice } = fakeVoice();
  const [a, b] = await Promise.all([1, 2].map(() => getOrCreateAudio(db.query, { postId, kind: "article", text: TEXT, lang: "fr" }, voice)));
  assert.ok(a.ok && b.ok && a.file === b.file);
  assert.equal(calls.length, 1);
});

test("lecture audio : sans service, texte vide ou plafond atteint, rien n'est fabriqué", async () => {
  const { db } = await createTestDb();
  const postId = await addPost(db);
  const { calls, voice } = fakeVoice();
  assert.deepEqual(await getOrCreateAudio(db.query, { postId, kind: "article", text: TEXT, lang: "fr" }, null), { ok: false, reason: "service" });
  assert.deepEqual(await getOrCreateAudio(db.query, { postId, kind: "article", text: "Court.", lang: "fr" }, voice), { ok: false, reason: "vide" });
  const broken = async () => { throw new Error("panne"); };
  assert.deepEqual(await getOrCreateAudio(db.query, { postId, kind: "article", text: TEXT, lang: "fr" }, broken), { ok: false, reason: "service" });
  process.env.VALYO_AUDIO_CARACTERES_PAR_JOUR = "150";
  try {
    assert.ok((await getOrCreateAudio(db.query, { postId, kind: "article", text: TEXT, lang: "fr" }, voice)).ok);
    const other = await addPost(db);
    assert.deepEqual(await getOrCreateAudio(db.query, { postId: other, kind: "article", text: TEXT, lang: "fr" }, voice), { ok: false, reason: "quota" });
    assert.equal(calls.length, 1);
  } finally { delete process.env.VALYO_AUDIO_CARACTERES_PAR_JOUR; }
});

test("lecture audio : le son d'une publication retirée est effacé au nettoyage", async () => {
  const { db } = await createTestDb();
  const postId = await addPost(db);
  const made = await getOrCreateAudio(db.query, { postId, kind: "article", text: TEXT, lang: "fr" }, fakeVoice().voice);
  assert.ok(made.ok);
  if (!made.ok) return;
  assert.equal(await sweepLecture(db.query), 0, "publication en ligne : rien à effacer");
  await db.query(`UPDATE posts SET status = 'removed' WHERE id = $1`, [postId]);
  const old = new Date(Date.now() - 3600_000);
  utimesSync(made.file, old, old);
  assert.equal(await sweepLecture(db.query), 1);
  assert.ok(!existsSync(made.file));
  assert.equal((await db.query(`SELECT 1 FROM post_audio WHERE post_id = $1`, [postId])).length, 0);
});

test("lecture audio : requête envoyée au service de voix", async () => {
  let seen: { url: string; body: Record<string, unknown>; auth: string } | null = null;
  const fetchFn = (async (url: string, init: RequestInit) => {
    seen = { url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) };
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  }) as unknown as typeof fetch;
  const audio = await openAiVoice({ apiKey: "cle-de-test", fetchFn })("Bonjour.", "fr");
  assert.equal(audio.length, 3);
  assert.equal(seen!.url, "https://api.openai.com/v1/audio/speech");
  assert.equal(seen!.auth, "Bearer cle-de-test");
  assert.equal(seen!.body.input, "Bonjour.");
  assert.equal(seen!.body.response_format, "mp3");
  assert.match(String(seen!.body.instructions), /français/);
  const failing = (async () => new Response("quota", { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(openAiVoice({ apiKey: "x", fetchFn: failing })("Bonjour.", "fr"), /429/);
});
