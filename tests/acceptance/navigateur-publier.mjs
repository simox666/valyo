// Recette NAVIGATEUR réelle (Chrome installé), contre un serveur ISOLÉ sur le port 3100
// (copie du dépôt sans .env.local, base PGlite dédiée). Non inclus dans npm test.
// playwright-core n'est pas une dépendance du projet : l'installer dans un dossier à part,
// copier ce fichier dans ce dossier, puis y lancer : OUT=./captures node navigateur-publier.mjs (imports ESM : NODE_PATH ne suffit pas)
// Recette navigateur réelle du parcours Publier (C016) contre le serveur isolé 3100.
// Base fictive, comptes fictifs, aucun e-mail réel.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3100";
const OUT = process.env.OUT ?? "./captures";
mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok, detail });
  console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
};

async function apiSignup(handle) {
  let cookie = "";
  const req = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  };
  const link = await req("POST", "/api/auth/request-link", { email: `${handle}@example.test`, next: "/" });
  const u = new URL(link.data.devLink);
  await req("GET", u.pathname + u.search);
  await req("POST", "/api/onboarding", { handle, displayName: handle === `auteur_${run}` ? "Camille Auteur" : "Autre membre", acceptRules: true, themeIds: [] });
  return { cookie, req };
}

// Préparation : un autre membre a déjà partagé une source (cas doublon).
const other = await apiSignup(`autre_${run}`);
const themesHtml = await (await fetch(BASE + "/publier", { headers: { Cookie: other.cookie } })).text();
const themeId = (themesHtml.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) ?? [])[0];
const shared = `https://labo-fictif.example/annonce-${run}`;
const pre = await other.req("POST", "/api/posts", { kind: "news", title: "Annonce déjà partagée par un membre", body: "Texte du membre.", themeIds: [themeId], sources: [shared] });
check("préparation : publication existante avec la même source", pre.status === 201, `HTTP ${pre.status}`);

const author = await apiSignup(`auteur_${run}`);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const [name, value] = author.cookie.split("=");
await context.addCookies([{ name, value, url: BASE }]);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("status of 409")) consoleErrors.push(m.text()); });
context.on("response", (r) => { if (r.status() >= 400 && r.status() !== 409) console.log("HTTP", r.status(), r.url()); });
context.on("requestfailed", (r) => console.log("ECHEC", r.url(), r.failure()?.errorText));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// 1. Arrivée et choix du type.
await page.goto(BASE + "/publier", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/01-publier-ordinateur.png`, fullPage: true });
check("page /publier rendue", await page.getByText("Que souhaitez-vous partager ?").isVisible());

// 2. Aperçu demandé sans rien remplir : erreurs listées, rien d'envoyé.
await page.getByRole("button", { name: "Voir l’aperçu →" }).click();
const alert = page.locator("main [role=alert]").first();
check("aperçu vide : récapitulatif d'erreurs affiché", await alert.isVisible(), (await alert.innerText()).replace(/\s+/g, " ").slice(0, 160));
check("aperçu vide : focus sur le récapitulatif", await page.evaluate(() => document.activeElement?.getAttribute("role") === "alert" && document.activeElement.id !== "__next-route-announcer__"));
await page.screenshot({ path: `${OUT}/02-erreurs.png`, fullPage: true });

// 3. Saisie complète.
const title = `Un robot de tri fictif présenté à Bruxelles ${run}`;
await page.fill("#title", title);
await page.fill("#body", "Résumé de démonstration : un institut fictif présente un robot de tri. Limites : aucun résultat publié.");
await page.locator("#post-themes input[type=checkbox]").first().check();
await page.fill("#source-0", shared);
await page.getByRole("button", { name: "+ Ajouter une source" }).click();
await page.fill("#source-1", `https://second-source.example/article-${run}`);
await page.fill("#demoUrl", "https://demo.example/outil");
check("compteur du titre à jour", await page.getByText(`${title.length}/200`).isVisible());

// 4. Aperçu, retour sans perte, nouvel aperçu.
await page.getByRole("button", { name: "Voir l’aperçu →" }).click();
const preview = page.getByRole("article", { name: "Aperçu de votre publication" });
check("aperçu : titre, auteur, sources et Tester", (await preview.innerText()).includes(title) && (await preview.innerText()).includes("Camille Auteur") && (await preview.getByText("Tester ↗").isVisible()));
await page.screenshot({ path: `${OUT}/03-apercu.png`, fullPage: true });
await page.getByRole("button", { name: "← Revenir à la rédaction" }).click();
check("retour à la rédaction : saisie conservée", (await page.inputValue("#title")) === title && (await page.inputValue("#source-1")) === `https://second-source.example/article-${run}`);
await page.getByRole("button", { name: "Voir l’aperçu →" }).click();

// 5. Publication → doublon → maintien explicite.
await page.getByRole("button", { name: "Publier maintenant" }).click();
await page.getByText("Cette source a déjà été partagée.").waitFor({ timeout: 10000 });
check("doublon détecté avec lien vers la discussion existante", await page.getByRole("link", { name: /Annonce déjà partagée par un membre/ }).isVisible());
await page.screenshot({ path: `${OUT}/04-doublon.png`, fullPage: true });
await page.getByRole("button", { name: "Publier quand même" }).click();
await page.getByText("Votre publication est en ligne.").waitFor({ timeout: 10000 });
check("confirmation après maintien", true);
await page.screenshot({ path: `${OUT}/05-confirmation.png`, fullPage: true });
const postHref = await page.getByRole("link", { name: "Voir ma publication →" }).getAttribute("href");
const postId = postHref.split("/").pop();

// 6. Créer un salon depuis la confirmation : publication et thème préremplis.
await page.getByRole("link", { name: "Créer un salon sur ce sujet" }).click();
await page.waitForURL(/\/salons\/nouveau\?post=/);
const pageText = await page.locator("main").innerText();
check("création de salon : publication d'origine rappelée", pageText.includes(title));
const selectedTheme = await page.locator("select").first().inputValue().catch(() => "");
check("création de salon : thème prérempli", selectedTheme === themeId, `thème sélectionné ${selectedTheme ? "oui" : "non"}`);
await page.screenshot({ path: `${OUT}/06-salon-depuis-publication.png`, fullPage: true });

// 7. Édition : type figé, aperçu, enregistrement, mention Modifié.
await page.goto(`${BASE}/p/${postId}/modifier`);
check("édition : type figé annoncé", await page.getByText("Le type d’une publication reste inchangé.").isVisible());
check("édition : aucun choix de type proposé", (await page.locator("input[name=kind]").count()) === 0);
await page.fill("#title", `${title} (corrigé)`);
await page.getByRole("button", { name: "Voir l’aperçu →" }).click();
await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
await page.waitForURL(new RegExp(`/p/${postId}$`), { timeout: 10000 });
const postText = await page.locator("main").innerText();
check("édition enregistrée, retour à la publication", postText.includes("(corrigé)"));
check("mention « Modifié » affichée", /Modifié/.test(postText));

// 8. Petits écrans : aucun débordement horizontal.
for (const width of [390, 320]) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(BASE + "/publier", { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`/publier à ${width} px : pas de défilement horizontal`, overflow <= 0, `débordement ${overflow} px`);
  await page.screenshot({ path: `${OUT}/07-publier-${width}.png`, fullPage: true });
}

// 9. Clavier : du choix du type à l'aperçu, sans souris.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE + "/publier");
await page.locator("input[name=kind][value=question]").focus();
await page.keyboard.press("Space");
check("clavier : type « question » sélectionnable", await page.locator("input[name=kind][value=question]").isChecked());
const focusVisible = await page.evaluate(() => {
  const el = document.activeElement;
  const s = el ? getComputedStyle(el) : null;
  return Boolean(s && (s.outlineStyle !== "none" || s.boxShadow !== "none"));
});
check("clavier : focus visible sur le choix du type", focusVisible);

check("aucune erreur JavaScript dans la console", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} contrôles réussis.`);
process.exit(failed.length ? 1 : 0);
