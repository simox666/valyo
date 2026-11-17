// Photos des membres : métadonnées supprimées, taille réduite, faux fichiers refusés, rattachement.
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { attachImages, processImage, readVisibleImage, saveUpload } from "../lib/media.ts";
import { createTestDb } from "./editorial-helpers.ts";

const photo = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#3a7" } })
    .jpeg()
    .withExif({ IFD0: { Make: "Téléphone secret", Copyright: "GPS 50.85N 4.35E" } })
    .toBuffer();

test("photo : réencodée en WebP, réduite, sans métadonnées ; un faux fichier est refusé", async () => {
  const input = await photo(4000, 3000);
  assert.ok((await sharp(input).metadata()).exif, "l'original contient des métadonnées");
  const out = await processImage(input);
  const meta = await sharp(out.data).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(Math.max(out.width, out.height), 1600);
  assert.equal(meta.exif, undefined, "aucune métadonnée conservée");
  await assert.rejects(processImage(Buffer.from("<script>alert(1)</script>")), /Format refusé/);
});

test("photo : enregistrée, visible avant publication, rattachée seulement par son auteur", async () => {
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), "valyo-photos-"));
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const ana = await user("ana");
  const ben = await user("ben");
  const saved = await saveUpload(db.query, ana, await photo(800, 600));
  assert.ok(saved.ok);
  const id = saved.image.id;
  assert.ok(await readFile(path.join(process.env.UPLOADS_DIR!, `${id}.webp`)));
  // SEC-02 : l'aperçu d'une photo non publiée est réservé à son propriétaire.
  const mine = await readVisibleImage(db.query, id, ana);
  assert.ok(mine && !mine.public, "aperçu avant publication : propriétaire seulement, jamais en cache partagé");
  assert.equal(await readVisibleImage(db.query, id, ben), null, "un autre membre ne voit pas l'aperçu");
  assert.equal(await readVisibleImage(db.query, id), null, "un anonyme ne voit pas l'aperçu");

  const [benPost] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', 'Titre ben', 'x') RETURNING id`, [ben]);
  await attachImages(db.query, benPost.id, ben, [id]);
  assert.equal((await db.query(`SELECT 1 FROM post_images WHERE post_id = $1`, [benPost.id])).length, 0, "photo d'un autre membre refusée");

  const [post] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', 'Titre ana', 'x') RETURNING id`, [ana]);
  await attachImages(db.query, post.id, ana, [id]);
  assert.equal((await db.query(`SELECT 1 FROM post_images WHERE post_id = $1`, [post.id])).length, 1);
  const published = await readVisibleImage(db.query, id);
  assert.ok(published?.public, "publication publiée : photo publique, cache partagé autorisé");

  await db.query(`UPDATE posts SET status = 'deleted' WHERE id = $1`, [post.id]);
  assert.equal(await readVisibleImage(db.query, id), null, "publication supprimée : photo plus servie à personne");
  assert.equal(await readVisibleImage(db.query, id, ana), null, "même à son auteur");
});
