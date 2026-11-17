// Regroupement règle 3 (decisions.md §3.3, lot d'accélération A6) : comparateur
// lexical injectable, fusion non destructrice, doute vers l'examen humain.
import assert from "node:assert/strict";
import { test } from "node:test";
import { compareForGrouping, type GroupingItem } from "../lib/editorial/grouping.ts";
import { createFixtureTransport } from "../lib/editorial/fixture-transport.ts";
import { runLocalTasks, type Deps } from "../lib/editorial/pipeline.ts";
import { createTestProvider } from "../lib/editorial/providers/test.ts";
import { enqueue } from "../lib/editorial/tasks.ts";
import type { Db } from "../lib/editorial/types.ts";
import { FIXTURES, configureForTests, createTestDb } from "./editorial-helpers.ts";

const NOW = new Date("2026-11-16T05:00:00Z");

function item(partial: Partial<GroupingItem> & { title: string; text: string }): GroupingItem {
  return { subjectId: partial.subjectId ?? "s", publishedAt: partial.publishedAt ?? NOW, ...partial };
}

test("règle 3 : même annonce chez deux émetteurs, contenus concordants → fusion", () => {
  const a = item({
    title: "Le lanceur Ariane réussit son premier vol depuis Kourou",
    text: "Le lanceur Ariane a réussi son premier vol commercial depuis Kourou, a annoncé l'agence.",
    publishedAt: new Date("2026-11-15T08:00:00Z"),
  });
  const b = item({
    title: "Premier vol réussi pour le lanceur Ariane depuis Kourou",
    text: "L'agence annonce que le premier vol commercial du lanceur Ariane depuis Kourou est réussi.",
    publishedAt: new Date("2026-11-15T13:00:00Z"),
  });
  const v = compareForGrouping(a, b);
  assert.equal(v.kind, "merge");
  assert.equal(v.evidence.quantitesSansEcho.length, 0);
  assert.ok(v.evidence.score >= 0.75);
});

test("règle 3 : faux rapprochement (objets différents) → distinct", () => {
  const v = compareForGrouping(
    item({ title: "Un robot chirurgical autorisé aux États-Unis", text: "L'autorité sanitaire américaine autorise un robot chirurgical pour l'orthopédie." }),
    item({ title: "Un robot aspirateur présenté en Allemagne", text: "Un fabricant allemand présente un robot aspirateur avec navigation embarquée." }),
  );
  assert.equal(v.kind, "distinct");
});

test("règle 3 : actualisations distinctes (quantités sans écho) → doublon incertain, pas de fusion", () => {
  const v = compareForGrouping(
    item({ title: "SpaceLab lance 60 satellites de sa constellation", text: "SpaceLab a mis en orbite 60 satellites de sa constellation jeudi." }),
    item({ title: "SpaceLab annonce 3000 satellites pour sa constellation", text: "SpaceLab vise désormais 3000 satellites pour sa constellation mondiale." }),
  );
  assert.equal(v.kind, "uncertain");
  assert.ok(v.evidence.quantitesSansEcho.includes("60"));
  assert.ok(v.evidence.quantitesSansEcho.includes("3000"));
});

test("règle 3 : plus de 72 heures d'écart ou date absente → distinct", () => {
  const a = item({ title: "Même annonce répétée mot pour mot", text: "Le même contenu exactement répété mot pour mot.", publishedAt: new Date("2026-11-10T00:00:00Z") });
  const b = item({ title: "Même annonce répétée mot pour mot", text: "Le même contenu exactement répété mot pour mot.", publishedAt: new Date("2026-11-14T00:01:00Z") });
  assert.equal(compareForGrouping(a, b).kind, "distinct");
  assert.equal(compareForGrouping(a, { ...b, publishedAt: null }).kind, "distinct");
});

// ───────────────────────────── Intégration dans la préparation ─────────────────────────────

async function seedSource(db: Db, name: string, priority: number) {
  const [s] = await db.query<{ id: string }>(
    `INSERT INTO editorial_sources (name, feed_url, source_type, priority, fetch_articles, active) VALUES ($1, $2, 'primary', $3, false, false) RETURNING id`,
    [name, `https://${name}.example/flux`, priority],
  );
  return s.id;
}

async function seedDoc(db: Db, sourceId: string, url: string, title: string, text: string, publishedAt: Date) {
  await db.query(
    `INSERT INTO editorial_documents (source_id, url, normalized_url, title, summary, published_at, discovered_at, content_hash, status, extracted_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, md5($2), 'extracted', $8)`,
    [sourceId, url, url.replace(/^https:\/\//, ""), title, text.slice(0, 400), publishedAt.toISOString(), NOW.toISOString(), text],
  );
}

async function prepare(db: Db): Promise<Deps> {
  const deps: Deps = { db, transport: createFixtureTransport(FIXTURES), provider: createTestProvider(db.query), now: () => NOW, owner: "test-grouping" };
  const [recap] = await db.query<{ id: string }>(
    `INSERT INTO editorial_recaps (slot_key, slot_at, state) VALUES ('test-regle-3', $1, 'planned') RETURNING id`,
    [new Date(NOW.getTime() + 3600_000).toISOString()],
  );
  await enqueue(db.query, { kind: "prepare_recap", key: "prepare:test-regle-3", payload: { recapId: recap.id } });
  await runLocalTasks(deps, 10);
  return deps;
}

test("préparation : la même annonce venue de deux sources est fusionnée sous la meilleure source, avec preuves", async () => {
  const { db } = await createTestDb();
  await configureForTests(db);
  const labo = await seedSource(db, "labo-regle3", 1);
  const presse = await seedSource(db, "presse-regle3", 3);
  const at = new Date("2026-11-15T08:00:00Z");
  await seedDoc(db, labo, "https://labo-regle3.example/annonce", "Le lanceur Ariane réussit son premier vol depuis Kourou",
    "Le lanceur Ariane a réussi son premier vol commercial depuis Kourou, a annoncé l'agence spatiale.", at);
  await seedDoc(db, presse, "https://presse-regle3.example/article", "Premier vol réussi pour le lanceur Ariane depuis Kourou",
    "L'agence spatiale annonce que le premier vol commercial du lanceur Ariane depuis Kourou est réussi.", new Date(at.getTime() + 5 * 3600_000));
  await seedDoc(db, presse, "https://presse-regle3.example/autre", "Un télescope sous-marin déployé en Méditerranée",
    "Un consortium européen déploie un télescope sous-marin à neutrinos en Méditerranée.", at);

  await prepare(db);

  const merged = await db.query(`SELECT * FROM editorial_subjects WHERE status = 'merged'`);
  assert.equal(merged.length, 1);
  assert.ok(merged[0].merged_into_subject_id);
  assert.equal((merged[0].grouping as { verdict: string }).verdict, "fusion");
  // Les documents des deux sources sont rattachés au sujet absorbant (meilleure priorité).
  const absorbing = merged[0].merged_into_subject_id as string;
  const docs = await db.query(`SELECT d.id FROM editorial_documents d WHERE d.subject_id = $1`, [absorbing]);
  assert.equal(docs.length, 2);
  // Le tri ne voit que deux candidats : le groupe fusionné et le sujet distinct.
  const [triage] = await db.query<{ payload: { input: { candidates: unknown[] } } }>(`SELECT payload FROM editorial_tasks WHERE kind = 'triage'`);
  assert.equal(triage.payload.input.candidates.length, 2);
});

test("préparation : rapprochement douteux → doublon_incertain avec preuves, aucun document déplacé", async () => {
  const { db } = await createTestDb();
  await configureForTests(db);
  const labo = await seedSource(db, "labo-doute", 1);
  const presse = await seedSource(db, "presse-doute", 3);
  const at = new Date("2026-11-15T08:00:00Z");
  await seedDoc(db, labo, "https://labo-doute.example/lancement", "SpaceLab lance 60 satellites de sa constellation",
    "SpaceLab a mis en orbite 60 satellites de sa constellation jeudi.", at);
  await seedDoc(db, presse, "https://presse-doute.example/objectif", "SpaceLab annonce 3000 satellites pour sa constellation",
    "SpaceLab vise désormais 3000 satellites pour sa constellation mondiale.", new Date(at.getTime() + 3600_000));

  await prepare(db);

  const doubtful = await db.query(`SELECT * FROM editorial_subjects WHERE block_reason = 'doublon_incertain'`);
  assert.equal(doubtful.length, 1);
  assert.equal(doubtful[0].status, "review_required");
  assert.equal((doubtful[0].grouping as { verdict: string }).verdict, "doublon_incertain");
  const [kept] = await db.query(`SELECT id FROM editorial_subjects WHERE status = 'drafting' OR status = 'candidate'`);
  assert.ok(kept, "le sujet de la meilleure source continue son chemin");
  // Chaque sujet garde son document : aucune fusion.
  const counts = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM editorial_documents GROUP BY subject_id`);
  assert.deepEqual(counts.map((c) => Number(c.n)), [1, 1]);
});
