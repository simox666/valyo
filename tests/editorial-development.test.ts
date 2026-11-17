// Développement lié (lot d'accélération A10) : demande administrateur uniquement
// (D8 proposé), réutilisation des tâches/vérification/budget, publication derrière
// la capacité désactivée, origine indisponible, correction et retrait.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  correctDevelopment,
  markOriginUnavailable,
  publishDevelopment,
  publishedDevelopmentFor,
  requestDevelopment,
  withdrawDevelopment,
} from "../lib/editorial/development.ts";
import { createFixtureTransport } from "../lib/editorial/fixture-transport.ts";
import { pollBatches, submitPending, type Deps } from "../lib/editorial/pipeline.ts";
import { createTestProvider } from "../lib/editorial/providers/test.ts";
import type { Db } from "../lib/editorial/types.ts";
import { SYNTHETIC_TRIAL_DOCUMENT } from "../lib/editorial/trial.ts";
import { FIXTURES, configureForTests, createTestDb } from "./editorial-helpers.ts";

const ACTOR = { actorId: null, actorLabel: "admin-test" };
let seq = 0;

/** Sujet vérifié avec son document, dans un récapitulatif « ready » ou « published ». */
async function seed(db: Db, recapState: "ready" | "published" = "ready") {
  const n = ++seq;
  let recapPostId: string | null = null;
  if (recapState === "published") {
    const [agent] = await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'agent'`);
    const [post] = await db.query<{ id: string }>(
      `INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', 'Récapitulatif publié', 'Corps.') RETURNING id`,
      [agent.id],
    );
    recapPostId = post.id;
  }
  const [recap] = await db.query<{ id: string }>(
    `INSERT INTO editorial_recaps (slot_key, slot_at, state, post_id) VALUES ($1, now(), $2, $3) RETURNING id`,
    [`dev-${n}`, recapState, recapPostId],
  );
  const [source] = await db.query<{ id: string }>(
    `INSERT INTO editorial_sources (name, feed_url, source_type, priority, fetch_articles, active) VALUES ($1, $2, 'primary', 1, false, false) RETURNING id`,
    [`Source dev ${n}`, `https://dev-${n}.example/flux`],
  );
  const [subject] = await db.query<{ id: string }>(
    `INSERT INTO editorial_subjects (group_key, title, status, recap_id, scientific_status) VALUES ($1, $2, 'ready', $3, 'announcement') RETURNING id`,
    [`dev-${n}`, SYNTHETIC_TRIAL_DOCUMENT.title, recap.id],
  );
  await db.query(
    `INSERT INTO editorial_documents (source_id, url, normalized_url, title, summary, published_at, content_hash, status, extracted_text, subject_id)
     VALUES ($1, $2, $3, $4, 'Résumé.', now(), md5($2), 'grouped', $5, $6)`,
    [source.id, `https://dev-${n}.example/article`, `dev-${n}.example/article`, SYNTHETIC_TRIAL_DOCUMENT.title, SYNTHETIC_TRIAL_DOCUMENT.text, subject.id],
  );
  const [item] = await db.query<{ id: string }>(
    `INSERT INTO editorial_recap_items (recap_id, subject_id, position, title, summary, scientific_status, sources, claims)
     VALUES ($1, $2, 1, $3, 'Résumé publié dans le récapitulatif, suffisamment long.', 'announcement', $4, '{"statements":[],"simulated":true}') RETURNING id`,
    [recap.id, subject.id, SYNTHETIC_TRIAL_DOCUMENT.title, JSON.stringify([{ url: `https://dev-${n}.example/article`, title: "Doc" }])],
  );
  return { recapId: recap.id, recapPostId, subjectId: subject.id, itemId: item.id };
}

function makeDeps(db: Db): Deps {
  return { db, transport: createFixtureTransport(FIXTURES), provider: createTestProvider(db.query), now: () => new Date(), owner: "dev-test" };
}

async function runProviderCycles(deps: Deps, cycles = 3) {
  for (let i = 0; i < cycles; i++) {
    await submitPending(deps);
    await pollBatches(deps);
  }
}

test("demande publique refusée tant que D8 est proposé ; demande administrateur acceptée une seule fois", async () => {
  const { db } = await createTestDb();
  await configureForTests(db);
  const { itemId } = await seed(db);

  const publicReq = await requestDevelopment(db, { recapItemId: itemId, trigger: "member", ...ACTOR });
  assert.deepEqual([publicReq.ok, (publicReq as { code: string }).code], [false, "public_desactive"]);

  const adminReq = await requestDevelopment(db, { recapItemId: itemId, trigger: "admin", ...ACTOR });
  assert.ok(adminReq.ok);
  const again = await requestDevelopment(db, { recapItemId: itemId, trigger: "admin", ...ACTOR });
  assert.deepEqual([again.ok, (again as { code: string }).code], [false, "deja"]);
});

test("le développement réutilise tâches, budget et vérification : article vérifié, sujet inchangé", async () => {
  const { db } = await createTestDb();
  await configureForTests(db);
  const { itemId, subjectId } = await seed(db);
  const deps = makeDeps(db);
  const req = await requestDevelopment(db, { recapItemId: itemId, trigger: "admin", ...ACTOR });
  assert.ok(req.ok);
  await runProviderCycles(deps);

  const [dev] = await db.query(`SELECT * FROM editorial_developments`);
  assert.equal(dev.state, "ready");
  const content = dev.content as { title: string; summary: string; verification: { simulated: boolean } };
  assert.ok(content.summary.length >= 200, "corps d'article développé");
  assert.equal(content.verification.simulated, true, "preuve marquée simulée (fournisseur de test)");

  // Budget réutilisé : chaque étape (develop puis verify) a été réservée puis rapprochée.
  const spend = await db.query(`SELECT state FROM editorial_spend`);
  assert.deepEqual(spend.map((s) => s.state), ["settled", "settled"]);
  const tasks = await db.query(`SELECT kind, state FROM editorial_tasks ORDER BY created_at`);
  assert.deepEqual(tasks.map((t) => `${t.kind}:${t.state}`), ["develop:done", "verify:done"]);
  const [subject] = await db.query(`SELECT status FROM editorial_subjects WHERE id = $1`, [subjectId]);
  assert.equal(subject.status, "ready", "le sujet du récapitulatif n'est pas modifié");
});

test("publication du développement : capacité désactivée, puis relation réciproque avec le récapitulatif", async () => {
  const { db } = await createTestDb();
  await configureForTests(db);
  const { itemId, subjectId, recapPostId } = await seed(db, "published");
  const deps = makeDeps(db);
  const req = await requestDevelopment(db, { recapItemId: itemId, trigger: "admin", ...ACTOR });
  assert.ok(req.ok);
  await runProviderCycles(deps);
  const developmentId = (await db.query<{ id: string }>(`SELECT id FROM editorial_developments`))[0].id;

  const refused = await publishDevelopment(db, { developmentId, ...ACTOR });
  assert.deepEqual([refused.ok, (refused as { code: string }).code], [false, "capacite"]);

  await db.query(`UPDATE editorial_config SET mode = 'public' WHERE id = 1`);
  const published = await publishDevelopment(db, { developmentId, ...ACTOR });
  assert.ok(published.ok);
  const [post] = await db.query(`SELECT * FROM posts WHERE id = $1`, [published.ok ? published.postId : ""]);
  assert.match(post.body as string, new RegExp(`/p/${recapPostId}`), "l'article renvoie vers le récapitulatif");
  const linked = await publishedDevelopmentFor(db.query, subjectId);
  assert.equal(linked?.post_id, post.id, "le récapitulatif peut renvoyer vers l'article");
});

test("origine indisponible : publication bloquée avant, avertissement ajouté après", async () => {
  const { db } = await createTestDb();
  await configureForTests(db);
  const { itemId } = await seed(db, "published");
  const deps = makeDeps(db);
  await requestDevelopment(db, { recapItemId: itemId, trigger: "admin", ...ACTOR });
  await runProviderCycles(deps);
  await db.query(`UPDATE editorial_config SET mode = 'public' WHERE id = 1`);
  const developmentId = (await db.query<{ id: string }>(`SELECT id FROM editorial_developments`))[0].id;

  // Avant publication : le drapeau bloque la publication.
  await markOriginUnavailable(db, { developmentId, motif: "page retirée par l'éditeur", ...ACTOR });
  const refused = await publishDevelopment(db, { developmentId, ...ACTOR });
  assert.deepEqual([refused.ok, (refused as { code: string }).code], [false, "origine"]);

  // Après publication : l'avertissement est ajouté en tête de l'article.
  await db.query(`UPDATE editorial_developments SET origin_unavailable = false WHERE id = $1`, [developmentId]);
  const published = await publishDevelopment(db, { developmentId, ...ACTOR });
  assert.ok(published.ok);
  await markOriginUnavailable(db, { developmentId, motif: "page retirée par l'éditeur", ...ACTOR });
  const [post] = await db.query(`SELECT body FROM posts WHERE id = $1`, [published.ok ? published.postId : ""]);
  assert.match(post.body as string, /^⚠ Origine indisponible/);
});

test("correction et retrait d'un développement publié : texte remplacé puis page indisponible", async () => {
  const { db } = await createTestDb();
  await configureForTests(db);
  const { itemId } = await seed(db, "published");
  const deps = makeDeps(db);
  await requestDevelopment(db, { recapItemId: itemId, trigger: "admin", ...ACTOR });
  await runProviderCycles(deps);
  await db.query(`UPDATE editorial_config SET mode = 'public' WHERE id = 1`);
  const developmentId = (await db.query<{ id: string }>(`SELECT id FROM editorial_developments`))[0].id;
  const published = await publishDevelopment(db, { developmentId, ...ACTOR });
  assert.ok(published.ok);

  const corrected = await correctDevelopment(db, {
    developmentId,
    title: "Titre corrigé du développement",
    summary: "Corps corrigé du développement après publication, suffisamment long pour satisfaire le schéma de l'article développé. ".repeat(3),
    motif: "Précision demandée par une source",
    ...ACTOR,
  });
  assert.ok(corrected.ok);
  const [dev] = await db.query(`SELECT * FROM editorial_developments WHERE id = $1`, [developmentId]);
  assert.equal((dev.content as { verification?: unknown }).verification, undefined, "vérification invalidée");
  assert.equal((dev.human_revision as { verificationInvalidee: boolean }).verificationInvalidee, true);
  const [post] = await db.query(`SELECT title, body FROM posts WHERE id = $1`, [published.ok ? published.postId : ""]);
  assert.equal(post.title, "Titre corrigé du développement");

  const withdrawn = await withdrawDevelopment(db, { developmentId, motif: "Erreur confirmée", ...ACTOR });
  assert.ok(withdrawn.ok);
  const [post2] = await db.query(`SELECT status FROM posts WHERE id = $1`, [published.ok ? published.postId : ""]);
  assert.equal(post2.status, "removed");
});
