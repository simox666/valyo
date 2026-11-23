// Messages vocaux des salons : format reconnu par ses octets, message et enregistrement
// créés ensemble, lecture réservée à qui peut lire le salon, effacement avec le message,
// le salon privé ou le compte. PGlite en mémoire, fichiers dans un dossier temporaire.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), "valyo-audio-"));

const { audioDir, audioFile, findAudio, sendVoiceMessage, sniffAudio, sweepAudio, MAX_AUDIO_MS, VOICE_BODY } = await import("../lib/rooms/audio.ts");
const { deleteMessage, editMessage, eventsSince, listMessages } = await import("../lib/rooms/chat.ts");
const { createRoom, joinRoom } = await import("../lib/rooms/service.ts");
const { eraseAccount } = await import("../lib/social/account.ts");
const { createTestDb } = await import("./editorial-helpers.ts");
type Db = Awaited<ReturnType<typeof createTestDb>>["db"];
type Viewer = { id: string; status: string; onboarded: boolean };

const mp4 = (size = 64) => { const b = Buffer.alloc(size, 7); b.write("ftypM4A ", 4, "latin1"); return b; };
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(40, 1)]);

let seq = 0;
async function addUser(db: Db): Promise<Viewer> {
  const n = ++seq;
  const [u] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ($1, $2, $3, now()) RETURNING id`,
    [`voix-${n}@example.test`, `voix_${n}`, `Voix ${n}`],
  );
  return { id: u.id, status: "active", onboarded: true };
}

async function setup(visibility: "public" | "private" = "private") {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const member = await addUser(db);
  const outsider = await addUser(db);
  const created = await createRoom(db.query, owner, { name: "Salon vocal", description: "", themeId: null, visibility, format: "chat", postId: null });
  assert.ok(created.ok);
  const roomId = created.ok ? created.roomId : "";
  if (visibility === "public") assert.ok((await joinRoom(db, member, roomId)).ok);
  return { db, owner, member, outsider, roomId };
}

test("le format est reconnu par l'en-tête du fichier, pas par son nom", () => {
  assert.equal(sniffAudio(mp4()), "audio/mp4");
  assert.equal(sniffAudio(webm()), "audio/webm");
  assert.equal(sniffAudio(Buffer.from("OggS" + "x".repeat(20), "latin1")), "audio/ogg");
  assert.equal(sniffAudio(Buffer.from("<html><script>alert(1)</script></html>")), null);
  assert.equal(sniffAudio(Buffer.from("RIFF1234WAVEfmt ")), null, "WAV non compressé refusé");
  assert.equal(sniffAudio(Buffer.alloc(4)), null);
});

test("envoi : message et enregistrement ensemble, relance sans doublon, fichier refusé sans trace", async () => {
  const { db, owner, outsider, roomId } = await setup();
  const sent = await db.transaction((q) => sendVoiceMessage(q, owner, roomId, { clientId: "v-1", data: mp4(), durationMs: 999_999 }));
  assert.ok(sent.ok && !sent.duplicate);
  const message = sent.ok ? sent.message : null;
  assert.equal(message?.body, VOICE_BODY);
  assert.equal(message?.audio?.durationMs, MAX_AUDIO_MS, "durée annoncée plafonnée à deux minutes");
  assert.ok(existsSync(audioFile(message!.audio!.id)), "fichier écrit");

  // Historique et flux d'événements portent l'enregistrement.
  const history = await db.transaction((q) => listMessages(q, owner, roomId));
  assert.ok(history.ok && history.messages[0].audio?.id === message!.audio!.id);
  assert.equal((await eventsSince(db.query, roomId, 0)).find((e) => e.kind === "message")?.message?.audio?.id, message!.audio!.id);

  // Relance du même envoi : le message existant, pas un second enregistrement.
  const again = await db.transaction((q) => sendVoiceMessage(q, owner, roomId, { clientId: "v-1", data: mp4(), durationMs: 3000 }));
  assert.ok(again.ok && again.duplicate && again.message.id === message!.id);
  assert.equal((await db.query(`SELECT id FROM room_audio`)).length, 1);

  // Pas un fichier audio, ou pas le droit d'écrire : rien n'est créé.
  const bad = await db.transaction((q) => sendVoiceMessage(q, owner, roomId, { clientId: "v-2", data: Buffer.from("pas du son du tout"), durationMs: 3000 }));
  assert.ok(!bad.ok && bad.code === "format");
  const refused = await db.transaction((q) => sendVoiceMessage(q, outsider, roomId, { clientId: "v-3", data: webm(), durationMs: 3000 }));
  assert.equal(refused.ok, false);
  assert.equal((await db.query(`SELECT id FROM room_audio`)).length, 1);
  assert.equal((await db.query(`SELECT id FROM room_messages`)).length, 1);

  // Un message vocal ne se « modifie » pas en texte.
  assert.equal((await db.transaction((q) => editMessage(q, owner, roomId, message!.id, "texte"))).ok, false);
});

test("écoute : membres d'un salon privé seulement ; visiteurs acceptés sur un salon public", async () => {
  const priv = await setup("private");
  const sent = await priv.db.transaction((q) => sendVoiceMessage(q, priv.owner, priv.roomId, { clientId: "v-1", data: webm(), durationMs: 4000 }));
  const audioId = sent.ok ? sent.message.audio!.id : "";
  assert.equal((await findAudio(priv.db.query, priv.owner, priv.roomId, audioId))?.mime, "audio/webm");
  assert.equal(await findAudio(priv.db.query, priv.outsider, priv.roomId, audioId), null, "non-membre refusé");
  assert.equal(await findAudio(priv.db.query, null, priv.roomId, audioId), null, "visiteur refusé");
  assert.equal(await findAudio(priv.db.query, priv.owner, priv.roomId, "../../etc/passwd"), null);

  const pub = await setup("public");
  const open = await pub.db.transaction((q) => sendVoiceMessage(q, pub.member, pub.roomId, { clientId: "v-1", data: mp4(), durationMs: 4000 }));
  const openId = open.ok ? open.message.audio!.id : "";
  assert.ok(await findAudio(pub.db.query, null, pub.roomId, openId), "salon public : l'aperçu est écoutable");
  // L'identifiant d'un autre salon ne donne rien.
  assert.equal(await findAudio(pub.db.query, pub.member, pub.roomId, audioId), null);
});

test("suppression du message ou du compte : l'enregistrement disparaît, ligne puis fichier", async () => {
  const { db, owner, member, roomId } = await setup("public");
  const a = await db.transaction((q) => sendVoiceMessage(q, owner, roomId, { clientId: "v-1", data: mp4(), durationMs: 4000 }));
  const b = await db.transaction((q) => sendVoiceMessage(q, member, roomId, { clientId: "v-1", data: mp4(), durationMs: 4000 }));
  const keep = await db.transaction((q) => sendVoiceMessage(q, owner, roomId, { clientId: "v-2", data: mp4(), durationMs: 4000 }));
  const [idA, idB, idKeep] = [a, b, keep].map((r) => (r.ok ? r.message.audio!.id : ""));
  const old = new Date(Date.now() - 3600_000);
  for (const id of [idA, idB, idKeep]) utimesSync(audioFile(id), old, old);

  // L'auteur supprime son message : plus écoutable tout de suite, fichier effacé au nettoyage.
  assert.ok((await db.transaction((q) => deleteMessage(q, owner, roomId, a.ok ? a.message.id : ""))).ok);
  assert.equal(await findAudio(db.query, owner, roomId, idA), null);
  // Le compte de `member` est supprimé : sa voix part avec lui.
  assert.deepEqual(await db.transaction((q) => eraseAccount(q, member.id)), { ok: true });
  const [left] = await db.query<{ body: string; audio_id: string | null }>(`SELECT body, audio_id FROM room_messages WHERE id = $1`, [b.ok ? b.message.id : ""]);
  assert.deepEqual(left, { body: "Message vocal supprimé", audio_id: null });

  // Fichier récent sans ligne (envoi en cours) épargné ; fichier temporaire abandonné nettoyé.
  const fresh = path.join(audioDir(), "11111111-1111-4111-8111-111111111111");
  writeFileSync(fresh, "x");
  const stale = path.join(audioDir(), "abandon.tmp");
  writeFileSync(stale, "x");
  utimesSync(stale, old, old);

  assert.equal(await sweepAudio(db.query), 3);
  assert.equal(existsSync(audioFile(idA)), false);
  assert.equal(existsSync(audioFile(idB)), false);
  assert.equal(existsSync(stale), false);
  assert.ok(existsSync(audioFile(idKeep)), "l'enregistrement d'un message toujours en ligne reste");
  assert.ok(existsSync(fresh), "un fichier de moins de dix minutes n'est pas touché");
  assert.ok(await findAudio(db.query, owner, roomId, idKeep));
});
