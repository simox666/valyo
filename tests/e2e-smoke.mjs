// Scénario de bout en bout contre un serveur lancé en développement
// (sans RESEND_API_KEY, pour que le lien de connexion soit renvoyé par l'API).
// Usage : BASE_URL=http://localhost:3000 node tests/e2e-smoke.mjs
// Chaque exécution crée de nouveaux comptes : à lancer sur une base de test.

import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const run = Date.now().toString(36);
let step = 0;
const ok = (label) => console.log(`✔ ${++step}. ${label}`);

class Client {
  constructor() {
    this.cookie = "";
  }
  async request(method, path, body, { redirect = "follow" } = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect,
      headers: {
        Origin: BASE,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, data, text, location: res.headers.get("location") };
  }
  async signUp(email, handle, next = "/") {
    const link = await this.request("POST", "/api/auth/request-link", { email, next });
    assert.equal(link.status, 200, link.text);
    assert.ok(link.data.devLink, "le lien de développement doit être renvoyé sans RESEND_API_KEY");
    const verify = await this.request("GET", new URL(link.data.devLink).pathname + new URL(link.data.devLink).search, undefined, { redirect: "manual" });
    assert.equal(verify.status, 303);
    assert.match(verify.location, /\/bienvenue\?next=/);
    const reuse = await new Client().request("GET", new URL(link.data.devLink).pathname + new URL(link.data.devLink).search, undefined, { redirect: "manual" });
    assert.match(reuse.location, /erreur=lien/, "un lien ne doit servir qu'une fois");
    return verify;
  }
}

const alice = new Client();
const bob = new Client();
const visitor = new Client();

// R01 côté visiteur : fil public lisible sans compte
let res = await visitor.request("GET", "/");
assert.equal(res.status, 200);
ok("le fil public s'affiche sans compte");

// Inscription (F01) et retour au contexte
await alice.signUp(`alice-${run}@example.test`, `alice_${run}`);
res = await alice.request("POST", "/api/posts", { kind: "question", title: "Avant inscription", body: "x", themeIds: [] });
assert.equal(res.status, 403, "une contribution exige une inscription terminée");
ok("connexion par lien à usage unique, contribution bloquée avant la fin de l'inscription");

res = await alice.request("POST", "/api/onboarding", { handle: "admin", displayName: "A", acceptRules: true, themeIds: [] });
assert.equal(res.status, 400);
assert.ok(res.data.fields.handle);
res = await alice.request("POST", "/api/onboarding", { handle: `alice_${run}`, displayName: "Alice", acceptRules: false, themeIds: [] });
assert.equal(res.status, 400);
assert.ok(res.data.fields.acceptRules);
res = await alice.request("POST", "/api/onboarding", { handle: `alice_${run}`, displayName: "Alice", acceptRules: true, themeIds: [] });
assert.equal(res.status, 200, res.text);
ok("pseudonyme réservé et règles non acceptées refusés, inscription terminée");

await bob.signUp(`bob-${run}@example.test`, `bob_${run}`);
res = await bob.request("POST", "/api/onboarding", { handle: `ALICE_${run}`, displayName: "Bob", acceptRules: true, themeIds: [] });
assert.equal(res.status, 409, "pseudonyme déjà pris, sans tenir compte de la casse");
res = await bob.request("POST", "/api/onboarding", { handle: `bob_${run}`, displayName: "Bob", acceptRules: true, themeIds: [] });
assert.equal(res.status, 200);
ok("pseudonyme unique, insensible à la casse");

// Récupère les thèmes depuis la page de rédaction rendue pour Alice
const composeHtml = (await alice.request("GET", "/publier")).text;
assert.match(composeHtml, /Intelligence artificielle/);
// La page sérialise d'autres identifiants (compte du membre, chemins de dev) : on n'extrait
// que les objets thème, reconnaissables à leur « slug » accolé à l'identifiant.
const themeIds = [...composeHtml.matchAll(/"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\?",\\?"slug/g)].map((m) => m[1]);
assert.ok(themeIds.length >= 3, "les identifiants de thème sont présents dans la page");
const ia = themeIds[0];

// Source facultative pour tous les types (décision du porteur, 16 novembre 2026) ; une source invalide reste refusée.
res = await alice.request("POST", "/api/posts", { kind: "news", title: "Une actualité sans source", body: "Texte", themeIds: [ia], sources: ["pas une adresse"] });
assert.equal(res.status, 400);
assert.ok(res.data.fields.sources);
res = await alice.request("POST", "/api/posts", { kind: "question", title: "Quel modèle local pour coder ?", body: "Vos retours ?", themeIds: [ia] });
assert.equal(res.status, 201, res.text);
const questionId = res.data.id;
ok("source facultative : question sans source acceptée, source invalide refusée avec explication");

res = await alice.request("POST", "/api/posts", {
  kind: "news",
  title: "Un nouveau modèle ouvert",
  body: "Résumé.",
  themeIds: [ia],
  sources: ["javascript:alert(1)"],
});
assert.equal(res.status, 400);
ok("source non http(s) refusée");

// R02 : actualité valide persistée et attribuée
const source = `https://www.example.com/news/${run}?utm_source=x`;
res = await alice.request("POST", "/api/posts", {
  kind: "news",
  title: "Un nouveau modèle ouvert",
  body: "Résumé de l'annonce.\n<script>alert(1)</script>",
  themeIds: [ia],
  sources: [source],
  demoUrl: "https://demo.example.com",
});
assert.equal(res.status, 201, res.text);
const newsId = res.data.id;
res = await visitor.request("GET", `/p/${newsId}`);
assert.equal(res.status, 200);
assert.match(res.text, /Un nouveau modèle ouvert/);
assert.match(res.text, /Alice/);
assert.match(res.text, /Tester/);
assert.doesNotMatch(res.text, /<script>alert\(1\)<\/script>/, "le contenu des membres n'est jamais interprété comme du code");
res = await visitor.request("GET", "/?vue=recentes");
assert.match(res.text, /Un nouveau modèle ouvert/);
ok("actualité publiée, lisible par un visiteur, dans le fil, contenu échappé");

// R04 : doublon détecté
res = await bob.request("POST", "/api/posts", {
  kind: "news",
  title: "Le même modèle, autre angle",
  body: "Mon analyse.",
  themeIds: [ia],
  sources: [`http://example.com/news/${run}/`],
});
assert.equal(res.status, 409);
assert.equal(res.data.duplicates[0].id, newsId);
res = await bob.request("POST", "/api/posts", {
  kind: "news",
  title: "Le même modèle, autre angle",
  body: "Mon analyse.",
  themeIds: [ia],
  sources: [`http://example.com/news/${run}/`],
  allowDuplicate: true,
});
assert.equal(res.status, 201);
const bobNewsId = res.data.id;
ok("doublon signalé avec la discussion existante, maintien possible après confirmation");

// Droits : Bob ne modifie pas la publication d'Alice
res = await bob.request("PATCH", `/api/posts/${newsId}`, { title: "Piraté", body: "x", themeIds: [ia], sources: [source] });
assert.equal(res.status, 403);
res = await bob.request("DELETE", `/api/posts/${newsId}`);
assert.equal(res.status, 403);
res = await visitor.request("POST", "/api/posts", { kind: "question", title: "Visiteur", body: "x", themeIds: [ia] });
assert.equal(res.status, 401);
ok("modification et suppression refusées à un autre membre et au visiteur");

// Contrôle d'origine
res = await fetch(`${BASE}/api/posts/${newsId}`, { method: "DELETE", headers: { Cookie: alice.cookie, Origin: "https://evil.example" } });
assert.equal(res.status, 403);
ok("requête d'un autre site refusée");

// Modification : mention « Modifié »
res = await alice.request("PATCH", `/api/posts/${newsId}`, {
  title: "Un nouveau modèle ouvert (mis à jour)",
  body: "Résumé corrigé.",
  themeIds: [ia],
  sources: [source],
  demoUrl: "",
});
assert.equal(res.status, 200, res.text);
res = await visitor.request("GET", `/p/${newsId}`);
assert.match(res.text, /mis à jour/);
assert.match(res.text, /Modifié le/);
ok("modification par l'auteur, mention Modifié affichée");

// Commentaires et réponses (F05)
res = await bob.request("POST", `/api/posts/${newsId}/comments`, { body: "Intéressant, des benchmarks ?" });
assert.equal(res.status, 201);
const c1 = res.data.id;
res = await alice.request("POST", `/api/posts/${newsId}/comments`, { body: "Oui, dans la source.", parentId: c1 });
assert.equal(res.status, 201);
const reply = res.data.id;
res = await bob.request("POST", `/api/posts/${newsId}/comments`, { body: "Merci !", parentId: reply });
assert.equal(res.status, 201, "répondre à une réponse reste à un seul niveau");
res = await alice.request("PATCH", `/api/comments/${c1}`, { body: "Piraté" });
assert.equal(res.status, 403);
res = await bob.request("DELETE", `/api/comments/${c1}`);
assert.equal(res.status, 200);
res = await visitor.request("GET", `/p/${newsId}`);
assert.match(res.text, /Commentaire supprimé/);
assert.match(res.text, /Oui, dans la source\./);
assert.doesNotMatch(res.text, /des benchmarks/);
ok("commentaires, réponses à un niveau, suppression laissant les réponses lisibles");

// Suivis et « Pour vous »
res = await bob.request("POST", "/api/follows", { target: "member", key: `alice_${run}`, follow: true });
assert.equal(res.status, 200);
res = await bob.request("POST", "/api/follows", { target: "member", key: `bob_${run}`, follow: true });
assert.equal(res.status, 400);
res = await bob.request("POST", "/api/follows", { target: "theme", key: "espace", follow: true });
assert.equal(res.status, 200);
res = await bob.request("GET", "/?vue=pour-vous");
assert.equal(res.status, 200);
assert.match(res.text, /Un nouveau modèle ouvert/);
res = await visitor.request("GET", `/m/alice_${run}`);
// Profil (refonte du 14 novembre) : le nombre d'abonnés est une case de statistiques.
assert.match(res.text, />1<\/p><p[^>]*>abonné</, "un abonné affiché sur le profil");
ok("suivi de membre et de thème, fil Pour vous non vide");

// R21 : suppression d'une publication
res = await bob.request("DELETE", `/api/posts/${bobNewsId}`);
assert.equal(res.status, 200);
res = await visitor.request("GET", `/p/${bobNewsId}`);
assert.match(res.text, /Publication indisponible/);
assert.doesNotMatch(res.text, /Mon analyse/);
ok("publication supprimée : état indisponible, contenu effacé");

// R22 : suppression du compte
res = await alice.request("DELETE", "/api/me", { confirm: "non" });
assert.equal(res.status, 400);
res = await alice.request("DELETE", "/api/me", { confirm: "SUPPRIMER" });
assert.equal(res.status, 200);
res = await alice.request("POST", `/api/posts/${questionId}/comments`, { body: "Encore là ?" });
assert.equal(res.status, 401, "la session est fermée");
res = await visitor.request("GET", `/m/alice_${run}`);
assert.equal(res.status, 404);
res = await visitor.request("GET", `/p/${newsId}`);
assert.match(res.text, /Membre supprimé/);
assert.doesNotMatch(res.text, /alice_/);
ok("compte supprimé : session fermée, profil retiré, contributions anonymisées");

// A001 + D33/D36 : compte suspendu par une VRAIE action de modération (le hook de
// changement de statut a été retiré ; l'outillage de recette est l'API de modération).
const admin = new Client();
{
  // Connexion directe (le compte admin-e2e peut déjà exister sur une base de test réutilisée).
  const link = await admin.request("POST", "/api/auth/request-link", { email: "admin-e2e@example.test", next: "/" });
  assert.equal(link.status, 200, link.text);
  await admin.request("GET", new URL(link.data.devLink).pathname + new URL(link.data.devLink).search, undefined, { redirect: "manual" });
}
await admin.request("POST", "/api/onboarding", { handle: `adm_${run}`, displayName: "Admin", acceptRules: true, themeIds: [] });
res = await admin.request("GET", "/admin/moderation");
assert.equal(res.status, 200, "lancer le serveur avec ADMIN_EMAILS=admin-e2e@example.test");
const suspend = async (client) => {
  const me = await client.request("GET", "/api/me");
  return admin.request("POST", "/api/admin/moderation/actions", {
    targetUserId: me.data.id,
    kind: "suspend",
    durationDays: 7,
    reason: "Recette e2e : suspension de test",
  });
};
const carol = new Client();
await carol.signUp(`carol-${run}@example.test`);
res = await carol.request("POST", "/api/onboarding", { handle: `carol_${run}`, displayName: "Carol", acceptRules: true, themeIds: [] });
assert.equal(res.status, 200);
res = await suspend(carol);
assert.equal(res.status, 201, res.text);
const carolSanctionId = res.data.actionId;
res = await carol.request("PATCH", "/api/me", { displayName: "Carol modifiée", bio: "Nouvelle bio", themeIds: [] });
assert.equal(res.status, 403, "profil public non modifiable par un compte suspendu");
res = await visitor.request("GET", `/m/carol_${run}`);
assert.doesNotMatch(res.text, /Carol modifiée/);
res = await carol.request("POST", "/api/posts", { kind: "question", title: "Suspendue ?", body: "x", themeIds: [ia] });
assert.equal(res.status, 403);
res = await carol.request("POST", `/api/posts/${questionId}/comments`, { body: "x" });
assert.equal(res.status, 403);
const dora = new Client();
await dora.signUp(`dora-${run}@example.test`);
res = await suspend(dora);
assert.equal(res.status, 201, res.text);
res = await dora.request("POST", "/api/onboarding", { handle: `dora_${run}`, displayName: "Dora", acceptRules: true, themeIds: [] });
assert.equal(res.status, 403, "inscription impossible pour un compte suspendu");

// D35 : la personne suspendue voit sa sanction motivée et peut la contester (une fois, 14 jours).
res = await carol.request("GET", "/sanctions");
assert.equal(res.status, 200);
assert.match(res.text, /Suspension/);
assert.match(res.text, /Recette e2e : suspension de test/);
res = await carol.request("POST", "/api/appeals", { actionId: carolSanctionId, body: "Je conteste : le contexte montrait le contraire." });
assert.equal(res.status, 201, res.text);
res = await carol.request("POST", "/api/appeals", { actionId: carolSanctionId, body: "Deuxième tentative interdite." });
assert.equal(res.status, 409, "une seule contestation par sanction");
// L'administrateur tranche (seul administrateur actif : l'examen par un tiers est impossible, donc permis).
res = await admin.request("GET", "/admin/moderation");
const appealId = (res.text.match(/appealId\\?":\\?"([0-9a-f-]{36})/) ?? [])[1];
assert.ok(appealId, "la contestation apparaît dans la file de modération");
res = await admin.request("POST", `/api/admin/moderation/appeals/${appealId}`, { decision: "levee", reason: "Contexte vérifié, sanction levée." });
assert.equal(res.status, 200, res.text);
res = await carol.request("PATCH", "/api/me", { displayName: "Carol réactivée", bio: "", themeIds: [] });
assert.equal(res.status, 200, "sanction levée : la contribution redevient possible");

res = await carol.request("DELETE", "/api/me", { confirm: "SUPPRIMER" });
assert.equal(res.status, 200, "la suppression de son compte reste possible");
ok("compte suspendu par la modération : contributions refusées, sanction motivée, contestation puis levée");

// D33 : bannissement de plateforme — sessions fermées, reconnexion impossible.
const fred = new Client();
await fred.signUp(`fred-${run}@example.test`);
await fred.request("POST", "/api/onboarding", { handle: `fred_${run}`, displayName: "Fred", acceptRules: true, themeIds: [] });
res = await fred.request("GET", "/api/me");
const fredId = res.data.id;
res = await admin.request("POST", "/api/admin/moderation/actions", { targetUserId: fredId, kind: "ban", reason: "Recette e2e : bannissement de test" });
assert.equal(res.status, 201, res.text);
res = await fred.request("GET", "/api/me");
assert.equal(res.status, 401, "toutes les sessions du banni sont fermées");
res = await new Client().request("POST", "/api/auth/request-link", { email: `fred-${run}@example.test` });
assert.equal(res.status, 200);
res = await new Client().request("GET", new URL(res.data.devLink).pathname + new URL(res.data.devLink).search, undefined, { redirect: "manual" });
assert.match(res.location ?? "", /erreur=banni/, "un compte banni ne peut pas rouvrir de session");
ok("bannissement de plateforme : distinct de la suspension, sessions fermées, connexion refusée");

// A002 : requêtes simultanées près de la limite (10 publications par heure par défaut).
const eve = new Client();
await eve.signUp(`eve-${run}@example.test`);
await eve.request("POST", "/api/onboarding", { handle: `eve_${run}`, displayName: "Eve", acceptRules: true, themeIds: [] });
for (let i = 0; i < 7; i++) {
  res = await eve.request("POST", "/api/posts", { kind: "question", title: `Question ${i} d'Eve`, body: "x", themeIds: [ia] });
  assert.equal(res.status, 201);
}
const burst = await Promise.all(
  Array.from({ length: 8 }, (_, i) => eve.request("POST", "/api/posts", { kind: "question", title: `Rafale ${i} d'Eve`, body: "x", themeIds: [ia] })),
);
assert.equal(burst.filter((r) => r.status === 201).length, 3, "3 places restantes");
assert.equal(burst.filter((r) => r.status === 429).length, 5);
const linkBurst = await Promise.all(
  Array.from({ length: 8 }, () => new Client().request("POST", "/api/auth/request-link", { email: `rafale-${run}@example.test` })),
);
assert.equal(linkBurst.filter((r) => r.status === 200).length, 5, "5 liens par heure et par adresse");
assert.equal(linkBurst.filter((r) => r.status === 429).length, 3);
ok("requêtes simultanées : seules les places restantes sont acceptées, les autres reçoivent 429");

// Indicateurs (decisions.md §5) : réservés aux administrateurs.
// Le serveur doit être lancé avec ADMIN_EMAILS=admin-e2e@example.test.
res = await bob.request("GET", "/admin/indicateurs");
assert.equal(res.status, 404, "page invisible pour un membre");
res = await visitor.request("GET", "/admin/indicateurs");
assert.equal(res.status, 404, "page invisible pour un visiteur");
// L'administrateur a été créé dans la section modération : on le réutilise.
res = await admin.request("GET", "/admin/indicateurs");
assert.equal(res.status, 200, "lancer le serveur avec ADMIN_EMAILS=admin-e2e@example.test");
assert.match(res.text, /Nouveaux membres reliés et revenus/);
assert.match(res.text, /Publications de l’agent éditorial/);
ok("indicateurs réservés aux administrateurs");

// Agent éditorial (lot 2A) : console et API réservées aux administrateurs.
for (const [who, client] of [["visiteur", visitor], ["membre", bob]]) {
  res = await client.request("GET", "/admin/editorial");
  assert.equal(res.status, 404, `console invisible pour un ${who}`);
  res = await client.request("PATCH", "/api/admin/editorial/config", { reason: "essai", paused: false });
  assert.equal(res.status, 404, `configuration refusée pour un ${who}`);
  res = await client.request("POST", "/api/admin/editorial/sources", { name: "x", feedUrl: "https://x.example/f.xml", sourceType: "press", priority: 3 });
  assert.equal(res.status, 404);
}
res = await admin.request("GET", "/admin/editorial");
assert.equal(res.status, 200);
assert.match(res.text, /aucun fournisseur choisi/);
assert.match(res.text, /non définie \(D8\)/);
res = await admin.request("PATCH", "/api/admin/editorial/config", { reason: "essai", mode: "public" });
assert.equal(res.status, 409, "mode public refusé en 2A");
res = await admin.request("PATCH", "/api/admin/editorial/config", { reason: "x" });
assert.equal(res.status, 400, "motif trop court");
res = await admin.request("POST", "/api/admin/editorial/sources", { name: "Laboratoire Exemple", feedUrl: "https://labo.example/flux.xml", sourceType: "primary", priority: 1 });
assert.equal(res.status, 201);
const sourceId = res.data.id;
res = await admin.request("PATCH", `/api/admin/editorial/sources/${sourceId}`, { active: true, reason: "activation" });
assert.equal(res.status, 400, "activation impossible sans référence d'autorisation");
res = await admin.request("PATCH", `/api/admin/editorial/sources/${sourceId}`, { active: true, authorizationReference: "Fixture locale, aucune source réelle", reason: "Recette e2e" });
assert.equal(res.status, 200);
res = await admin.request("PATCH", "/api/admin/editorial/config", {
  reason: "Recette e2e : politique à fenêtres chevauchantes",
  policy: { slots: [{ weekday: 1, time: "07:00" }, { weekday: 2, time: "07:00" }], maxItems: 6, prepLeadHours: 30 },
});
assert.equal(res.status, 400, "préparation plus longue que l'écart entre deux créneaux : refusée explicitement");
assert.match(res.data.error, /non supporté/);
res = await admin.request("PATCH", "/api/admin/editorial/config", {
  reason: "Recette e2e : fournisseur de test et politique de fixture",
  paused: false,
  provider: "test",
  prices: { inputPerMTokMicros: 4000000, outputPerMTokMicros: 20000000 },
  currency: "USD",
  budgetCap: "5.00",
  timezone: "Europe/Brussels",
  policy: { slots: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, time: "07:00" })), maxItems: 6, prepLeadHours: 20 },
});
assert.equal(res.status, 200, res.text);
res = await admin.request("GET", "/admin/editorial");
assert.match(res.text, /Fournisseur de test déterministe actif/);
assert.doesNotMatch(res.text, /test_[0-9a-f-]{36}/, "aucun identifiant externe de fournisseur exposé");
ok("agent éditorial : console et API réservées aux administrateurs, mode public refusé, activation tracée");

// Rendu public d'un récapitulatif publié (lot d'accélération A9), sur données de
// démonstration semées par le hook de test (aucune publication réelle).
res = await visitor.request("POST", "/api/test-hooks", { action: "seed-demo-recap" });
assert.equal(res.status, 200, res.text);
const demoPostId = res.data.postId;
res = await visitor.request("GET", `/p/${demoPostId}`);
assert.equal(res.status, 200);
assert.match(res.text, /Agent éditorial/, "distinction de l'agent affichée");
assert.match(res.text, /id="n-[0-9a-f-]{36}"/, "ancres stables par nouvelle");
assert.match(res.text, /Prépublication non relue/, "statut scientifique affiché");
assert.match(res.text, /rédigé automatiquement par l(’|')agent éditorial/, "mention d'origine automatisée");
assert.match(res.text, /demo.invalid/, "sources de démonstration citées");
ok("récapitulatif publié : rendu public structuré (ancres, statuts, sources, distinction agent)");

// ─── Salons et droits (lot d'accélération B) ───
const rita = new Client();
const sam = new Client();
const theo = new Client();
await rita.signUp(`rita-${run}@example.test`);
await rita.request("POST", "/api/onboarding", { handle: `rita_${run}`, displayName: "Rita", acceptRules: true, themeIds: [] });
await sam.signUp(`sam-${run}@example.test`);
await sam.request("POST", "/api/onboarding", { handle: `sam_${run}`, displayName: "Sam", acceptRules: true, themeIds: [] });
await theo.signUp(`theo-${run}@example.test`);
await theo.request("POST", "/api/onboarding", { handle: `theo_${run}`, displayName: "Theo", acceptRules: true, themeIds: [] });

res = await rita.request("POST", "/api/posts", { kind: "question", title: `Question salon ${run}`, body: "Pour créer un salon.", themeIds: [ia] });
assert.equal(res.status, 201, res.text);
const roomPostId = res.data.id;
res = await rita.request("POST", "/api/rooms", { name: `Salon public ${run}`, description: "Discussion de test", themeId: null, visibility: "public", format: "chat", postId: roomPostId });
assert.equal(res.status, 201, res.text);
const publicRoomId = res.data.roomId;
res = await rita.request("POST", "/api/rooms", { name: `Salon privé ${run}`, description: "Réservé", themeId: null, visibility: "private", format: "chat", postId: null });
assert.equal(res.status, 201, res.text);
const privateRoomId = res.data.roomId;

// Annuaire et publication : le public s'affiche, le privé ne fuit jamais.
res = await visitor.request("GET", "/salons");
assert.equal(res.status, 200);
assert.match(res.text, new RegExp(`Salon public ${run}`));
assert.doesNotMatch(res.text, new RegExp(`Salon privé ${run}`), "un salon privé n'apparaît pas dans l'annuaire");
res = await visitor.request("GET", `/s/${privateRoomId}`);
assert.equal(res.status, 404, "un salon privé est introuvable pour un visiteur");
res = await sam.request("GET", `/s/${privateRoomId}`);
assert.equal(res.status, 404, "un salon privé est introuvable pour un non-membre");
res = await visitor.request("GET", `/p/${roomPostId}`);
assert.match(res.text, new RegExp(`Salon public ${run}`), "la publication montre le salon associé");
res = await sam.request("POST", `/api/rooms/${privateRoomId}/join`, undefined);
assert.equal(res.status, 404, "adhésion directe à un salon privé refusée sans le révéler");
ok("salons : annuaire public, association à la publication, aucun indice d'un salon privé");

// Adhésion, suivi, sanction d'un non-membre refusée.
res = await sam.request("POST", `/api/rooms/${publicRoomId}/join`, undefined);
assert.equal(res.status, 200, res.text);
res = await sam.request("POST", `/api/rooms/${publicRoomId}/follow`, { following: true });
assert.equal(res.status, 200);
res = await theo.request("GET", "/api/me");
const theoId = res.data.id;
res = await rita.request("POST", `/api/rooms/${publicRoomId}/members/${theoId}`, { action: "kick", reason: "test hors salon" });
assert.equal(res.status, 409, "on ne sanctionne pas un non-membre");
ok("salons : adhésion et suivi distincts, sanction bornée aux membres");

// Invitation à usage unique sur le salon privé.
res = await rita.request("POST", `/api/rooms/${privateRoomId}/invitations`, undefined);
assert.equal(res.status, 201, res.text);
const inviteToken = res.data.url.split("/").pop();
res = await sam.request("POST", "/api/invitations/accept", { token: inviteToken });
assert.equal(res.status, 200, res.text);
assert.equal(res.data.roomId, privateRoomId);
res = await theo.request("POST", "/api/invitations/accept", { token: inviteToken });
assert.equal(res.status, 409, "une invitation ne sert qu'une fois");
res = await sam.request("GET", `/s/${privateRoomId}`);
assert.equal(res.status, 200, "le nouvel arrivant lit le salon privé");
ok("salons : invitation explicite, à usage unique, consommée atomiquement");

// Propriétaire : départ bloqué, transfert accepté, puis départ possible.
res = await rita.request("POST", `/api/rooms/${privateRoomId}/leave`, undefined);
assert.equal(res.status, 409, "le propriétaire transfère ou archive avant de partir");
res = await sam.request("GET", "/api/me");
const samId = res.data.id;
assert.ok(samId, res.text);
res = await rita.request("POST", `/api/rooms/${privateRoomId}/transfer`, { toUserId: samId });
assert.equal(res.status, 200, res.text);
// La proposition apparaît à son destinataire sur la page du salon (bannière), avec son identifiant.
res = await sam.request("GET", `/s/${privateRoomId}`);
const transferId = (res.text.match(/transferId\\?":\\?"([0-9a-f-]{36})/) ?? [])[1];
assert.ok(transferId, "la proposition de transfert est visible pour son destinataire");
res = await sam.request("POST", `/api/transfers/${transferId}`, { answer: "accept" });
assert.equal(res.status, 200, res.text);
res = await rita.request("POST", `/api/rooms/${privateRoomId}/leave`, undefined);
assert.equal(res.status, 200, "l'ancien propriétaire peut quitter après transfert");
ok("salons : transfert de propriété proposé, accepté, départ alors possible");

// ─── Chat réel (lot d'accélération C) ───
async function readStream(client, path, until, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let buffer = "";
  try {
    const streamRes = await fetch(BASE + path, { headers: { Cookie: client.cookie }, signal: controller.signal });
    assert.equal(streamRes.status, 200, `flux ${path}`);
    assert.match(streamRes.headers.get("content-type") ?? "", /text\/event-stream/);
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (until.test(buffer)) break;
    }
  } catch (error) {
    if (error.name !== "AbortError") throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  return buffer;
}

res = await theo.request("POST", `/api/rooms/${publicRoomId}/join`, undefined);
assert.equal(res.status, 200, res.text);

// Deux clients distincts : Sam écoute le flux, Theo envoie ; latence mesurée.
const listening = readStream(sam, `/api/rooms/${publicRoomId}/stream?cursor=0`, /event: message/);
await new Promise((r) => setTimeout(r, 1200)); // laisser le flux s'ouvrir
const sentAt = Date.now();
res = await theo.request("POST", `/api/rooms/${publicRoomId}/messages`, { clientId: `e2e-${run}-1`, body: "Premier message du chat" });
assert.equal(res.status, 201, res.text);
const theoMessageSeq = res.data.message.seq;
const streamText = await listening;
const latencyMs = Date.now() - sentAt;
assert.match(streamText, /event: message/, "l'événement d'envoi arrive sur le flux de l'autre client");
assert.match(streamText, /Premier message du chat/);
console.log(`   latence mesurée (envoi → événement SSE, serveur dev local, intervalle de lecture 1,5 s) : ${latencyMs} ms`);

// Relance avec le même identifiant client : aucun doublon.
res = await theo.request("POST", `/api/rooms/${publicRoomId}/messages`, { clientId: `e2e-${run}-1`, body: "Premier message du chat" });
assert.equal(res.status, 200);
assert.equal(res.data.duplicate, true);
res = await sam.request("GET", `/api/rooms/${publicRoomId}/messages`);
assert.equal(res.status, 200);
assert.equal(res.data.messages.filter((m) => m.body === "Premier message du chat").length, 1, "un seul exemplaire du message");

// Reprise par curseur : un flux ouvert avec un curseur ancien rejoue l'événement manqué.
const replayed = await readStream(sam, `/api/rooms/${publicRoomId}/stream?cursor=0`, /Premier message du chat/);
assert.match(replayed, /Premier message du chat/, "les événements manqués sont rejoués");

// Repère de lecture monotone.
res = await sam.request("POST", `/api/rooms/${publicRoomId}/read`, { seq: theoMessageSeq });
assert.equal(res.status, 200);
res = await sam.request("POST", `/api/rooms/${publicRoomId}/read`, { seq: 0 });
assert.equal(res.data.lastReadSeq, theoMessageSeq, "le repère ne recule pas");

// Un visiteur ne lit ni l'historique ni le flux.
res = await visitor.request("GET", `/api/rooms/${publicRoomId}/messages`);
assert.equal(res.status, 401);
ok("chat : deux clients, envoi persistant sans doublon, flux SSE avec reprise, repère monotone");

// Exclusion PENDANT le flux : l'événement de révocation ferme l'accès de Theo.
const revokedStream = readStream(theo, `/api/rooms/${publicRoomId}/stream`, /event: revoked/);
await new Promise((r) => setTimeout(r, 1200));
res = await theo.request("GET", "/api/me");
res = await rita.request("POST", `/api/rooms/${publicRoomId}/members/${theoId}`, { action: "kick", reason: "recette e2e" });
assert.equal(res.status, 200, res.text);
const revokedText = await revokedStream;
assert.match(revokedText, /event: revoked/, "le flux du membre exclu reçoit la révocation");
res = await theo.request("POST", `/api/rooms/${publicRoomId}/messages`, { clientId: `e2e-${run}-2`, body: "trop tard" });
assert.equal(res.status, 403, "écriture refusée après exclusion");
ok("chat : exclusion pendant le flux, révocation émise côté serveur, écriture refusée");

// Suppression de compte bloquée tant qu'un salon actif est possédé.
res = await rita.request("DELETE", "/api/me", { confirm: "SUPPRIMER" });
assert.equal(res.status, 409, "suppression bloquée : Rita possède encore le salon public");
assert.match(res.data.error, /transférez|archivez/i);
res = await rita.request("PATCH", `/api/rooms/${publicRoomId}`, { archive: true });
assert.equal(res.status, 200, res.text);
res = await rita.request("DELETE", "/api/me", { confirm: "SUPPRIMER" });
assert.equal(res.status, 200, res.text);
ok("salons : la suppression de compte exige transfert ou archivage des salons possédés");

// ─── Notifications, blocage, recherche (lot d'accélération D) ───

// Notification de réponse (D29) : Eve répond à Bob ; Bob est notifié, jamais Eve d'elle-même.
res = await bob.request("POST", "/api/posts", { kind: "question", title: `Question notification ${run}`, body: "Qui répond ?", themeIds: [ia] });
assert.equal(res.status, 201, res.text);
const notifPostId = res.data.id;
res = await eve.request("POST", `/api/posts/${notifPostId}/comments`, { body: "Réponse d'Eve pour la notification." });
assert.equal(res.status, 201, res.text);
res = await bob.request("GET", "/api/notifications");
assert.equal(res.status, 200);
assert.ok(res.data.unread >= 1, "Bob a une notification non lue");
assert.ok(res.data.notifications.some((n) => n.kind === "reply" && n.postId === notifPostId), "la réponse d'Eve est notifiée");
res = await eve.request("GET", "/api/notifications");
assert.ok(!res.data.notifications.some((n) => n.postId === notifPostId), "jamais d'auto-notification");

// Notification de salon suivi, regroupée : Sam suivait le salon public pendant les messages de Theo.
res = await sam.request("GET", "/api/notifications");
assert.ok(res.data.notifications.some((n) => n.kind === "room_message" && n.roomId === publicRoomId), "les messages du salon suivi sont notifiés, regroupés");
res = await bob.request("POST", "/api/notifications", { all: true });
assert.equal(res.status, 200);
res = await bob.request("GET", "/api/notifications");
assert.equal(res.data.unread, 0, "tout marqué lu");
ok("notifications : réponse et salon suivi, regroupement, marquage lu, aucune auto-notification");

// Blocage (D31) : Bob bloque Eve → publications hors du fil de Bob, commentaire masqué.
res = await bob.request("GET", "/api/me");
const bobId = res.data.id;
res = await eve.request("GET", "/api/me");
const eveId = res.data.id;
res = await bob.request("POST", "/api/blocks", { userId: eveId, blocked: true });
assert.equal(res.status, 200, res.text);
res = await bob.request("GET", "/");
assert.doesNotMatch(res.text, /d'Eve|d&#x27;Eve/, "les publications d'Eve disparaissent du fil de Bob");
res = await visitor.request("GET", "/");
assert.match(res.text, /Eve/, "le blocage ne touche que le bloqueur");
res = await bob.request("GET", `/p/${notifPostId}`);
assert.match(res.text, /Commentaire masqué/, "le commentaire d'Eve est masqué pour Bob");
assert.doesNotMatch(res.text, /Réponse d(’|&#x27;)Eve pour la notification/);
res = await eve.request("POST", `/api/posts/${notifPostId}/comments`, { body: "Seconde réponse d'Eve, sans notification." });
assert.equal(res.status, 201);
res = await bob.request("GET", "/api/notifications");
assert.equal(res.data.unread, 0, "un membre bloqué ne notifie plus");
res = await bob.request("POST", "/api/blocks", { userId: eveId, blocked: false });
assert.equal(res.status, 200);
ok("blocage : fil et commentaires masqués pour le bloqueur seul, notifications coupées, déblocage possible");

// Signalement (D32) : confidentialité du signalant côté public.
res = await bob.request("POST", "/api/reports", { targetKind: "post", targetId: notifPostId, reason: "spam", details: "" });
assert.equal(res.status, 409, "on ne signale pas sa propre publication");
res = await eve.request("POST", "/api/reports", { targetKind: "post", targetId: notifPostId, reason: "autre", details: "Recette e2e." });
assert.equal(res.status, 201, res.text);
res = await admin.request("GET", "/admin/moderation");
assert.equal(res.status, 200);
assert.match(res.text, new RegExp(`eve_${run}`), "le signalant n'apparaît qu'à la modération");
res = await bob.request("GET", "/admin/moderation");
assert.equal(res.status, 404, "file invisible hors modération");
ok("signalements : file réservée à la modération, signalant confidentiel, auto-signalement refusé");

// Recherche (D28) : par type, sans jamais exposer un salon privé.
res = await visitor.request("GET", `/recherche?q=${encodeURIComponent(`Salon public ${run}`)}`);
assert.equal(res.status, 200);
assert.match(res.text, new RegExp(`href="/s/${publicRoomId}"`), "le salon public est trouvé");
res = await visitor.request("GET", `/recherche?q=${encodeURIComponent(`Salon privé ${run}`)}`);
assert.match(res.text, /Aucun résultat pour/, "un salon privé n'apparaît jamais dans la recherche (état vide global)");
assert.match(res.text, /salons sur invitation ne sont jamais listés/);
assert.doesNotMatch(res.text, new RegExp(privateRoomId), "aucun identifiant de salon privé ne fuit");
res = await visitor.request("GET", `/recherche?q=${encodeURIComponent(`Question notification ${run}`)}`);
assert.match(res.text, new RegExp(`href="/p/${notifPostId}"`));
res = await visitor.request("GET", "/recherche?q=a");
assert.match(res.text, /au moins deux caractères/);
ok("recherche : publications, membres, thèmes et salons publics, état vide contrôlé, aucun salon privé");

console.log(`\nTous les contrôles sont passés (${step}).`);
