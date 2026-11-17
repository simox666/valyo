// Révision éditoriale administrative (lot d'accélération A7).
import assert from "node:assert/strict";
import { test } from "node:test";
import { reviseRecapItem } from "../lib/editorial/revision.ts";
import type { Db } from "../lib/editorial/types.ts";
import { createTestDb } from "./editorial-helpers.ts";

async function seedItem(db: Db, recapState = "ready") {
  const [recap] = await db.query<{ id: string }>(
    `INSERT INTO editorial_recaps (slot_key, slot_at, state) VALUES ('revision-test', now(), $1) RETURNING id`,
    [recapState],
  );
  const [subject] = await db.query<{ id: string }>(
    `INSERT INTO editorial_subjects (group_key, title, status) VALUES ('revision-test', 'Sujet de test', 'ready') RETURNING id`,
  );
  const [item] = await db.query<{ id: string }>(
    `INSERT INTO editorial_recap_items (recap_id, subject_id, position, title, summary, scientific_status, sources, claims)
     VALUES ($1, $2, 1, 'Titre initial du brouillon', 'Résumé initial du brouillon, suffisamment long pour le schéma.', 'announcement',
             '[{"url":"https://exemple.test/a","title":"Doc"}]', '{"statements":[{"text":"x","quote":"y"}],"simulated":true}') RETURNING id`,
    [recap.id, subject.id],
  );
  return { recapId: recap.id, itemId: item.id };
}

const ARGS = { motif: "Chiffre corrigé d'après la source", actorId: null, actorLabel: "admin-test" };

test("révision avec changement de texte : vérification invalidée, motif et historique conservés", async () => {
  const { db } = await createTestDb();
  const { itemId } = await seedItem(db);
  const outcome = await db.transaction((q) =>
    reviseRecapItem(q, { itemId, title: "Titre corrigé du brouillon", summary: "Résumé corrigé du brouillon, suffisamment long pour le schéma.", ...ARGS }),
  );
  assert.deepEqual(outcome, { ok: true, verificationInvalidated: true });

  const [item] = await db.query(`SELECT * FROM editorial_recap_items WHERE id = $1`, [itemId]);
  assert.equal(item.title, "Titre corrigé du brouillon");
  assert.equal(item.claims, null, "la vérification ne s'applique plus au texte modifié");
  const revision = item.human_revision as { motif: string; verificationInvalidee: boolean; historique: { precedent: { title: string } }[] };
  assert.equal(revision.motif, ARGS.motif);
  assert.equal(revision.verificationInvalidee, true);
  assert.equal(revision.historique.length, 1);
  assert.equal(revision.historique[0].precedent.title, "Titre initial du brouillon");

  const log = await db.query(`SELECT * FROM editorial_revisions WHERE entity = 'recap_item' AND entity_id = $1`, [itemId]);
  assert.equal(log.length, 1);
  assert.match(log[0].reason as string, /Révision éditoriale/);

  // Seconde révision : l'historique s'allonge, il n'écrase pas la première.
  await db.transaction((q) =>
    reviseRecapItem(q, { itemId, title: "Titre corrigé une deuxième fois", summary: "Résumé corrigé une deuxième fois, suffisamment long.", ...ARGS, motif: "Formulation précisée" }),
  );
  const [item2] = await db.query(`SELECT human_revision FROM editorial_recap_items WHERE id = $1`, [itemId]);
  assert.equal((item2.human_revision as { historique: unknown[] }).historique.length, 2);
});

test("révision sans changement de texte : refusée, rien n'est modifié", async () => {
  const { db } = await createTestDb();
  const { itemId } = await seedItem(db);
  const outcome = await db.transaction((q) =>
    reviseRecapItem(q, { itemId, title: "Titre initial du brouillon", summary: "Résumé initial du brouillon, suffisamment long pour le schéma.", ...ARGS }),
  );
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "inchange");
  const [item] = await db.query(`SELECT claims FROM editorial_recap_items WHERE id = $1`, [itemId]);
  assert.ok(item.claims, "la vérification reste valide");
});

test("récapitulatif publié ou retiré : révision refusée (voie de correction éditoriale distincte)", async () => {
  const { db } = await createTestDb();
  const { itemId } = await seedItem(db, "published");
  const outcome = await db.transaction((q) =>
    reviseRecapItem(q, { itemId, title: "Titre différent pour le test", summary: "Résumé différent pour le test, suffisamment long.", ...ARGS }),
  );
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "etat");
});

test("ACC05 — relecture liée à la version affichée et au texte exact, puis nouvelle révision invalidante", async (t) => {
  const { approveRecapItem, itemEvidenceValid, markRecapReady } = await import("../lib/editorial/revision.ts");
  const { db, lite } = await createTestDb();
  t.after(() => lite.close());
  const { itemId, recapId } = await seedItem(db);
  const revise = (title: string) => db.transaction((q) => reviseRecapItem(q, { itemId, title, summary: "Résumé humain confronté aux sources pour cette relecture.", ...ARGS }));
  assert.ok((await revise("Première version à relire")).ok);
  assert.ok((await revise("Seconde version encore inconnue du relecteur")).ok);
  const stale = await db.transaction((q) => approveRecapItem(q, { itemId, expectedVersion: 2, ...ARGS }));
  assert.ok(!stale.ok && stale.code === "version", "une page ancienne ne permet pas d'approuver le texte remplacé");
  assert.ok((await db.transaction((q) => approveRecapItem(q, { itemId, expectedVersion: 3, ...ARGS }))).ok);
  const [item] = await db.query<{ claims: unknown; human_revision: unknown }>(`SELECT * FROM editorial_recap_items WHERE id = $1`, [itemId]);
  assert.equal(itemEvidenceValid(item), true);
  assert.equal(itemEvidenceValid({ ...item, summary: "Autre texte" }), false);
  assert.ok((await db.transaction((q) => markRecapReady(q, { recapId, expectedVersion: 3, ...ARGS }))).ok);
  assert.ok((await revise("Troisième version qui invalide la relecture")).ok);
  const [again] = await db.query<{ claims: unknown; human_revision: unknown }>(`SELECT * FROM editorial_recap_items WHERE id = $1`, [itemId]);
  assert.equal(itemEvidenceValid(again), false);
});
