// Bêta sur invitation et avis des testeurs. PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFeedback, FEEDBACK_PER_DAY, listFeedback } from "../lib/social/feedback.ts";
import {
  admitByEmail,
  createPlatformInvitation,
  listInvitations,
  registrationMode,
  revokePlatformInvitation,
  signupDecision,
  validInvitation,
} from "../lib/social/invitations.ts";
import type { Db } from "../lib/editorial/types.ts";
import { createTestDb } from "./editorial-helpers.ts";

let seq = 0;
async function member(db: Db, status = "active") {
  const n = ++seq;
  const [u] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, status, rules_accepted_at) VALUES ($1, $2, $3, $4, now()) RETURNING id`,
    [`beta-${n}@example.test`, `beta_${n}`, `Membre ${n}`, status],
  );
  return u.id;
}

function withMode<T>(mode: string | undefined, fn: () => Promise<T>) {
  const before = process.env.INSCRIPTIONS;
  if (mode === undefined) delete process.env.INSCRIPTIONS;
  else process.env.INSCRIPTIONS = mode;
  return fn().finally(() => {
    if (before === undefined) delete process.env.INSCRIPTIONS;
    else process.env.INSCRIPTIONS = before;
  });
}

test("mode d'inscription : invitation par défaut en production, ouvert sinon, forçable par variable", () => {
  const env = process.env as Record<string, string | undefined>;
  const nodeEnv = env.NODE_ENV;
  const before = env.INSCRIPTIONS;
  delete env.INSCRIPTIONS;
  env.NODE_ENV = "production";
  assert.equal(registrationMode(), "invitation");
  env.NODE_ENV = "development";
  assert.equal(registrationMode(), "ouvertes");
  env.INSCRIPTIONS = "invitation";
  assert.equal(registrationMode(), "invitation");
  env.NODE_ENV = nodeEnv;
  if (before === undefined) delete env.INSCRIPTIONS;
  else env.INSCRIPTIONS = before;
});

test("sur invitation : nouveau compte refusé sans invitation ; compte existant toujours admis", () =>
  withMode("invitation", async () => {
    const { db } = await createTestDb();
    await member(db);
    assert.deepEqual(await signupDecision(db.query, "inconnu@example.test", null), { allowed: false });
    assert.deepEqual(await signupDecision(db.query, "inconnu@example.test", "jeton-bidon-tres-long"), { allowed: false });
    assert.deepEqual(await signupDecision(db.query, "BETA-1@example.test", null), { allowed: true, invitationId: null }, "connexion d'un membre existant");
    assert.equal(await admitByEmail(db, "inconnu@example.test", null), null, "aucun compte créé sans invitation");
    assert.equal((await db.query(`SELECT 1 FROM users WHERE email = 'inconnu@example.test'`)).length, 0);
  }));

test("invitation : consommée à la création du compte seulement, une seule fois, avec trace de qui a invité", () =>
  withMode("invitation", async () => {
    const { db } = await createTestDb();
    const inviter = await member(db);
    const created = await db.transaction((q) => createPlatformInvitation(q, { creatorId: inviter, isAdmin: false, note: "Léa" }));
    assert.ok(created.ok);
    const token = created.ok ? created.token : "";
    assert.equal((await validInvitation(db.query, token))?.inviterName, "Membre " + (seq));

    // Deux demandes de lien (faute de frappe puis bonne adresse) : l'invitation n'est pas gaspillée.
    const typo = await signupDecision(db.query, "lea@exmple.test", token);
    const good = await signupDecision(db.query, "lea@example.test", token);
    assert.ok(typo.allowed && good.allowed);
    const lea = await admitByEmail(db, "lea@example.test", good.allowed ? good.invitationId : null);
    assert.ok(lea, "compte créé avec l'invitation");
    // Le second lien (adresse avec faute) ne peut plus créer de compte : l'invitation est consommée.
    assert.equal(await admitByEmail(db, "lea@exmple.test", typo.allowed ? typo.invitationId : null), null);
    assert.equal(await validInvitation(db.query, token), null);
    const [inv] = await listInvitations(db.query, { creatorId: inviter });
    assert.deepEqual([inv.state, inv.note], ["utilisee", "Léa"]);
    const [row] = await db.query(`SELECT used_by FROM platform_invitations`);
    assert.equal(row.used_by, lea!.id);
  }));

test("quota des membres, administration illimitée, révocation, compte suspendu refusé", async () => {
  const { db } = await createTestDb();
  const m = await member(db);
  const admin = await member(db);
  const suspended = await member(db, "suspended");
  process.env.LIMIT_MEMBER_INVITES = "2";
  try {
    const a = await db.transaction((q) => createPlatformInvitation(q, { creatorId: m, isAdmin: false, note: "" }));
    const b = await db.transaction((q) => createPlatformInvitation(q, { creatorId: m, isAdmin: false, note: "" }));
    const c = await db.transaction((q) => createPlatformInvitation(q, { creatorId: m, isAdmin: false, note: "" }));
    assert.ok(a.ok && b.ok);
    assert.deepEqual([c.ok, !c.ok && c.code], [false, "quota"]);
    // Révoquer une invitation inutilisée rend une place.
    assert.ok(await db.transaction((q) => revokePlatformInvitation(q, { id: a.ok ? a.id : "", userId: m, isAdmin: false })));
    assert.equal(await validInvitation(db.query, a.ok ? a.token : ""), null, "révoquée = inutilisable");
    assert.ok((await db.transaction((q) => createPlatformInvitation(q, { creatorId: m, isAdmin: false, note: "" }))).ok);
    // Un autre membre ne révoque pas l'invitation d'autrui.
    assert.equal(await db.transaction((q) => revokePlatformInvitation(q, { id: b.ok ? b.id : "", userId: admin, isAdmin: false })), false);
    for (let i = 0; i < 4; i++) assert.ok((await db.transaction((q) => createPlatformInvitation(q, { creatorId: admin, isAdmin: true, note: "" }))).ok);
    const refused = await db.transaction((q) => createPlatformInvitation(q, { creatorId: suspended, isAdmin: false, note: "" }));
    assert.equal(refused.ok, false);
  } finally {
    delete process.env.LIMIT_MEMBER_INVITES;
  }
});

test("invitation expirée : inutilisable", () =>
  withMode("invitation", async () => {
    const { db } = await createTestDb();
    const inviter = await member(db);
    const inv = await db.transaction((q) => createPlatformInvitation(q, { creatorId: inviter, isAdmin: true, note: "" }));
    await db.query(`UPDATE platform_invitations SET expires_at = now() - interval '1 minute'`);
    assert.equal(await validInvitation(db.query, inv.ok ? inv.token : ""), null);
    assert.equal(await admitByEmail(db, "tard@example.test", inv.ok ? inv.id : null), null);
  }));

test("avis des testeurs : enregistrés, limités à 10 par jour, listés pour l'administration", async () => {
  const { db } = await createTestDb();
  const m = await member(db);
  assert.ok((await db.transaction((q) => createFeedback(q, { userId: m, kind: "bug", body: "Le bouton ne répond pas.", page: "/salons" }))).ok);
  for (let i = 1; i < FEEDBACK_PER_DAY; i++) await db.transaction((q) => createFeedback(q, { userId: m, kind: "idee", body: `Idée numéro ${i}`, page: "" }));
  const over = await db.transaction((q) => createFeedback(q, { userId: m, kind: "idee", body: "Une de trop", page: "" }));
  assert.equal(over.ok, false);
  const list = await listFeedback(db.query);
  assert.equal(list.length, FEEDBACK_PER_DAY);
  assert.ok(list.some((f) => f.kind === "bug" && f.page === "/salons"));
});

test("sur invitation : les adresses ADMIN_EMAILS entrent sans invitation (ouverture de la bêta)", () =>
  withMode("invitation", async () => {
    const { db } = await createTestDb();
    process.env.ADMIN_EMAILS = "Porteur@Example.test";
    try {
      assert.deepEqual(await signupDecision(db.query, "porteur@example.test", null), { allowed: true, invitationId: null });
      assert.ok(await admitByEmail(db, "porteur@example.test", null));
      assert.equal(await admitByEmail(db, "autre@example.test", null), null);
    } finally {
      delete process.env.ADMIN_EMAILS;
    }
  }));
