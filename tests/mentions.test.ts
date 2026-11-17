// Lot social : mentions @pseudo, meilleure réponse, « parmi vos abonnements ».
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractMentions, notifyMentions } from "../lib/social/mentions.ts";
import { mentionSuggestions } from "../lib/social/people.ts";
import { followedReactions } from "../lib/social/reactions.ts";
import { computeProgress } from "../lib/social/progress.ts";
import { createTestDb } from "./editorial-helpers.ts";

test("mentions : extraction stricte (pseudos valides, pas d'e-mails, 8 max, sans doublon)", () => {
  assert.deepEqual(extractMentions("Bravo @ana et @Ben_2 ! cc @ana"), ["ana", "ben_2"]);
  assert.deepEqual(extractMentions("écris-moi sur jean@exemple.fr ou /m/@x"), [], "e-mail et @ collé à un mot ou / ignorés");
  assert.deepEqual(extractMentions("@ab trop court, @vraiment_tres_long_pseudo_depasse non"), []);
  assert.equal(extractMentions(Array.from({ length: 12 }, (_, i) => `@pseudo${i}`).join(" ")).length, 8);
});

test("mentions : notifiées en base, jamais soi-même, ni un bloqueur, ni hors d'un salon ; pas de doublon avec la réponse", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const [ana, ben, cleo, dan] = [await user("ana"), await user("ben"), await user("cleo"), await user("dan")];
  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [cleo, ana]); // cleo a bloqué ana
  const [post] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', 'Titre', 'x') RETURNING id`, [ben]);

  // Comme dans createComment : ben (déjà notifié de la réponse) est exclu, cleo a bloqué ana,
  // @ana (soi-même) est ignoré ; seul dan est notifié.
  const count = await notifyMentions(db.query, { actorId: ana, text: "Vu avec @ben @cleo @dan et @ana", postId: post.id, exclude: [ben] });
  assert.equal(count, 1);
  const notifs = await db.query<{ user_id: string; kind: string }>(`SELECT user_id, kind FROM notifications ORDER BY kind`);
  assert.deepEqual(notifs.map((n) => [n.user_id, n.kind]), [[dan, "mention"]]);

  // Salon : seuls les membres sont notifiés (rien ne fuit, pas de harcèlement à distance).
  const [room] = await db.query<{ id: string }>(`INSERT INTO rooms (name, owner_id, visibility) VALUES ('Labo', $1, 'private') RETURNING id`, [ana]);
  await db.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [room.id, ana, ben]);
  const n = await notifyMentions(db.query, { actorId: ana, text: "@ben @dan regardez", roomId: room.id });
  assert.equal(n, 1, "dan n'est pas membre du salon : pas notifié");
  const roomNotifs = await db.query<{ user_id: string }>(`SELECT user_id FROM notifications WHERE kind = 'mention' AND room_id = $1`, [room.id]);
  assert.deepEqual(roomNotifs.map((x) => x.user_id), [ben]);
});

test("mentions : suggestions « @ » = abonnements puis abonnés, filtrées par préfixe, jamais un bloqué ; en salon, ses membres seulement", async () => {
  const { db } = await createTestDb();
  const user = async (h: string, name = h) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $2, now()) RETURNING id`, [h, name]))[0].id;
  const [moi, ana, abel, bea, paria, loin] = [
    await user("moi"), await user("ana", "Ana Grib"), await user("abel"), await user("bea", "Abigaëlle"), await user("paria"), await user("loin"),
  ];
  // moi suit ana et paria ; abel et bea me suivent ; loin n'a aucun lien ; paria m'a bloqué.
  await db.query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2), ($1, $3), ($4, $1), ($5, $1)`, [moi, ana, paria, abel, bea]);
  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [paria, moi]);

  const all = await mentionSuggestions(db.query, moi, "");
  assert.deepEqual(all.map((c) => c.handle), ["ana", "abel", "bea"], "abonnements d'abord, ni bloqueur ni inconnu");
  const ab = await mentionSuggestions(db.query, moi, "ab");
  assert.deepEqual(ab.map((c) => c.handle), ["abel", "bea"], "préfixe sur le pseudo ou le début du nom affiché (Abigaëlle)");
  assert.deepEqual((await mentionSuggestions(db.query, moi, "a_b%")).length, 0, "les jokers SQL sont neutralisés");

  // Salon : les membres (même non suivis), et uniquement eux ; rien pour un non-membre.
  const [room] = await db.query<{ id: string }>(`INSERT INTO rooms (name, owner_id, visibility) VALUES ('Labo', $1, 'private') RETURNING id`, [moi]);
  await db.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [room.id, moi, loin]);
  assert.deepEqual((await mentionSuggestions(db.query, moi, "", room.id)).map((c) => c.handle), ["loin"]);
  assert.deepEqual(await mentionSuggestions(db.query, ana, "", room.id), [], "non-membre du salon : aucune suggestion");
});

test("meilleure réponse : 3 points de progression pour son auteur dans le thème de la question", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const [ana, ben] = [await user("ana"), await user("ben")];
  const [theme] = await db.query<{ id: string }>(`SELECT id FROM themes WHERE slug = 'ia'`);
  const [q] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', 'Comment ?', 'x') RETURNING id`, [ben]);
  await db.query(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [q.id, theme.id]);
  const [c] = await db.query<{ id: string }>(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'Comme ça') RETURNING id`, [q.id, ana]);
  const before = (await computeProgress(db.query, ana)).themes.find((t) => t.slug === "ia")!;
  await db.query(`UPDATE posts SET best_comment_id = $2 WHERE id = $1`, [q.id, c.id]);
  const after = (await computeProgress(db.query, ana)).themes.find((t) => t.slug === "ia")!;
  assert.equal(after.points - before.points, 3);
});

test("fil : « parmi vos abonnements », membres suivis qui ont réagi, deux noms puis le reste compté", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const [moi, a, b, c, inconnu] = [await user("moi"), await user("aa_a"), await user("bb_b"), await user("cc_c"), await user("inconnu")];
  const [post] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', 'Titre', 'x') RETURNING id`, [inconnu]);
  await db.query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2), ($1, $3), ($1, $4)`, [moi, a, b, c]);
  await db.query(
    `INSERT INTO post_reactions (post_id, user_id, kind, created_at) VALUES
     ($1, $2, 'appris', now() - interval '3 min'), ($1, $2, 'interessant', now() - interval '2 min'),
     ($1, $3, 'appris', now() - interval '1 min'), ($1, $4, 'appris', now() - interval '4 min'), ($1, $5, 'appris', now())`,
    [post.id, a, b, c, inconnu],
  );
  const map = await followedReactions(db.query, [post.id], moi);
  const r = map.get(post.id)!;
  assert.equal(r.total, 3, "le membre non suivi ne compte pas");
  assert.deepEqual(r.names, ["bb_b", "aa_a"], "les plus récents d'abord, deux noms au plus");
  assert.equal((await followedReactions(db.query, [post.id], inconnu)).get(post.id), undefined, "sans abonnement, rien");
});
