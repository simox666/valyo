// Notifications push : abonnements par appareil et file d'envoi (réservation unique,
// regroupement, discrétion du contenu, rien de rétroactif ni de périmé). PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import { claimPending, isPushEndpoint, removeSubscription, saveSubscription, subscriptionsOf } from "../lib/push/core.ts";
import { eraseAccount } from "../lib/social/account.ts";
import { createTestDb } from "./editorial-helpers.ts";

test("seuls les services de push des navigateurs sont acceptés comme destination", () => {
  assert.ok(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"));
  assert.ok(isPushEndpoint("https://web.push.apple.com/QGk"));
  assert.ok(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"));
  assert.equal(isPushEndpoint("http://fcm.googleapis.com/x"), false, "http refusé");
  assert.equal(isPushEndpoint("https://exemple.fr/hook"), false);
  assert.equal(isPushEndpoint("https://googleapis.com.exemple.fr/x"), false);
  assert.equal(isPushEndpoint("https://127.0.0.1/x"), false);
  assert.equal(isPushEndpoint("pas une url"), false);
});

test("abonnements, file d'envoi et suppression de compte", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) =>
    (await db.query<{ id: string }>(
      `INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ($1, $2, $3, now()) RETURNING id`,
      [`${h}@exemple.fr`, h, h[0].toUpperCase() + h.slice(1)],
    ))[0].id;
  const [ana, ben] = [await user("ana"), await user("ben")];
  const sub = (n: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: "p".repeat(40), auth: "a".repeat(16) } });

  // Un appareil = un abonnement ; s'il change de compte, il change de propriétaire.
  await saveSubscription(db.query, ana, sub("tel-ana"));
  await saveSubscription(db.query, ana, sub("ordi"));
  await saveSubscription(db.query, ben, sub("ordi"));
  assert.deepEqual((await subscriptionsOf(db.query, [ana, ben])).map((s) => [s.user_id === ana ? "ana" : "ben", s.endpoint.split("/").pop()]).sort(), [["ana", "tel-ana"], ["ben", "ordi"]]);
  await removeSubscription(db.query, sub("ordi").endpoint, ana); // pas le sien : sans effet
  assert.equal((await subscriptionsOf(db.query, [ben])).length, 1);

  // Rien en attente au départ.
  assert.deepEqual(await db.transaction((q) => claimPending(q)), []);

  const [post] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', 'Pourquoi le ciel est bleu ?', 'corps') RETURNING id`, [ana]);
  const [comment] = await db.query<{ id: string }>(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'Diffusion de Rayleigh') RETURNING id`, [post.id, ben]);
  await db.query(`INSERT INTO notifications (user_id, kind, post_id, comment_id, actor_id) VALUES ($1, 'reply', $2, $3, $4)`, [ana, post.id, comment.id, ben]);
  await db.query(`INSERT INTO notifications (user_id, kind, body) VALUES ($1, 'moderation', 'Motif détaillé confidentiel')`, [ana]);
  // Déjà lue, ou trop ancienne : réservée mais jamais envoyée.
  await db.query(`INSERT INTO notifications (user_id, kind, post_id, actor_id, read_at) VALUES ($1, 'relay', $2, $3, now())`, [ana, post.id, ben]);
  await db.query(`INSERT INTO notifications (user_id, kind, post_id, actor_id, created_at) VALUES ($1, 'relay', $2, $3, now() - interval '2 hours')`, [ana, post.id, ben]);

  // Messages privés : une rafale de trois = un seul push, sans le texte.
  const [conv] = await db.query<{ id: string }>(`INSERT INTO conversations (user_a, user_b) VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid)) RETURNING id`, [ana, ben]);
  await db.query(`INSERT INTO direct_messages (conversation_id, sender_id, body) VALUES ($1, $2, 'secret un'), ($1, $2, 'secret deux'), ($1, $2, 'secret trois')`, [conv.id, ben]);

  const first = await db.transaction((q) => claimPending(q));
  assert.deepEqual(first.map((m) => [m.userId === ana ? "ana" : "ben", m.title, m.url]).sort((x, y) => x[1].localeCompare(y[1])), [
    ["ana", "Ben", "/messages/ben"],
    ["ana", "Ben vous a répondu", `/p/${post.id}`],
    ["ana", "Valyo", "/notifications"],
  ]);
  const text = JSON.stringify(first);
  assert.ok(!text.includes("secret") && !text.includes("confidentiel"), "ni message privé ni motif de modération dans un push");
  assert.ok(first.some((m) => m.body === "3 nouveaux messages privés"));
  assert.ok(first.some((m) => m.body.includes("Pourquoi le ciel est bleu")));

  // Tout est réservé : un second passage n'envoie rien.
  assert.deepEqual(await db.transaction((q) => claimPending(q)), []);

  // Un destinataire suspendu ne reçoit rien.
  await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [ben]);
  await db.query(`INSERT INTO direct_messages (conversation_id, sender_id, body) VALUES ($1, $2, 'coucou')`, [conv.id, ana]);
  assert.deepEqual(await db.transaction((q) => claimPending(q)), []);

  // La suppression du compte retire ses abonnements.
  await db.transaction((q) => eraseAccount(q, ana));
  assert.equal((await subscriptionsOf(db.query, [ana])).length, 0);
});
