// Recette NAVIGATEUR réelle (Chrome installé), contre un serveur ISOLÉ sur le port 3100
// (copie du dépôt sans .env.local, base PGlite dédiée). Non inclus dans npm test.
// playwright-core n'est pas une dépendance du projet : l'installer dans un dossier à part,
// copier ce fichier dans ce dossier, puis y lancer : OUT=./captures node navigateur-premiers-pas.mjs
// Recette navigateur réelle : accueil des nouveaux membres (« Premiers pas »).
// Serveur ISOLÉ 3100, base fictive, comptes fictifs, aucun e-mail réel.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3100";
const OUT = process.env.OUT ?? "./captures";
mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
};

async function apiMember(handle, displayName, themeSlugs = []) {
  let cookie = "";
  const req = async (method, path, body) => {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get("set-cookie"); if (set) cookie = set.split(";")[0];
    let data = null; try { data = await res.json(); } catch {} return { status: res.status, data };
  };
  const link = await req("POST", "/api/auth/request-link", { email: `${handle}@example.test`, next: "/" });
  const u = new URL(link.data.devLink); await req("GET", u.pathname + u.search);
  await req("POST", "/api/onboarding", { handle, displayName, acceptRules: true, themeIds: [] });
  for (const slug of themeSlugs) await req("POST", "/api/follows", { target: "theme", key: slug, follow: true });
  return { req, cookie };
}

// ── Une petite communauté fictive, avec de vraies interactions. ──
const html = await (await fetch(BASE + "/salons")).text();
const ana = await apiMember(`ana_${run}`, "Ana Robotique", ["robotique"]);
const publierHtml = await (await fetch(BASE + "/publier", { headers: { Cookie: ana.cookie } })).text();
const themeIds = [...new Set(publierHtml.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g))];
// Ordre des thèmes dans la page : celui de la robotique est retrouvé par son libellé.
const roboId = (publierHtml.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[^{}]{0,200}?Robotique/) ?? [])[1];
console.log("thème robotique trouvé :", Boolean(roboId));
const q = await ana.req("POST", "/api/posts", { kind: "question", title: `Quel bras robotique pour débuter ? ${run}`, body: "Je cherche un premier kit pour apprendre, budget limité.", themeIds: [roboId] });
check("communauté : question publiée", q.status === 201);
const room = await ana.req("POST", "/api/rooms", { name: `Atelier robotique ${run}`, description: "Montages, pannes et conseils.", themeId: roboId, visibility: "public", format: "chat", postId: null });
check("communauté : salon créé", room.status === 201);
await ana.req("POST", `/api/rooms/${room.data.roomId}/messages`, { clientId: "m1", body: "Bienvenue dans l'atelier !" });
const leo = await apiMember(`leo_${run}`, "Léo Espace", ["espace"]);
await leo.req("POST", `/api/posts/${q.data.id}/comments`, { body: "Regarde du côté des kits open source." });

// ── Une nouvelle personne s'inscrit PAR L'INTERFACE. ──
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

await page.goto(BASE + "/connexion", { waitUntil: "networkidle" });
await page.fill("input[type=email]", `nina_${run}@example.test`);
await page.getByRole("button", { name: "Recevoir le lien de connexion" }).click();
const devLink = page.getByRole("link", { name: "Ouvrir le lien de connexion" });
await devLink.waitFor({ timeout: 10000 });
await devLink.click();
await page.waitForURL(/\/bienvenue/, { timeout: 15000 });
await page.waitForLoadState("networkidle");
await page.fill("#handle", `nina_${run}`);
await page.fill("#displayName", "Nina");
await page.getByText("Robotique", { exact: true }).click();
await page.locator("input[type=checkbox]").last().check();
await page.getByRole("button", { name: "Terminer l’inscription" }).click();
await page.waitForURL(/\/bienvenue\/premiers-pas/, { timeout: 15000 });
await page.waitForLoadState("networkidle");
check("après l'inscription : arrivée sur « Premiers pas »", true, page.url().replace(BASE, ""));
const main = () => page.locator("main").innerText();
let text = await main();
check("accueil personnalisé (nom et thème choisi)", text.includes("Bienvenue, Nina") && text.includes("Robotique"));
check("progression 0 sur 3", text.includes("0 sur 3"));
check("question réelle sans réponse de Nina proposée", text.includes(`Quel bras robotique pour débuter ? ${run}`));
check("salon actif du thème proposé, marqué « Votre thème »", text.includes(`Atelier robotique ${run}`) && text.includes("Votre thème"));
check("membres actifs proposés, thème partagé en tête", text.indexOf("Ana Robotique") >= 0 && (text.indexOf("Léo Espace") < 0 || text.indexOf("Ana Robotique") < text.indexOf("Léo Espace")));
check("« Aime aussi : Robotique » affiché", text.includes("Aime aussi : Robotique"));
await page.screenshot({ path: `${OUT}/10-premiers-pas.png`, fullPage: true });

// Suivre un membre : la progression avance, le membre suivi sort des suggestions.
await page.locator("li", { hasText: `@ana_${run}` }).getByRole("button", { name: "Suivre" }).click();
await page.waitForFunction(() => document.querySelector("main")?.innerText.includes("1 sur 3"), null, { timeout: 10000 });
check("après « Suivre » : 1 sur 3", true);

// Accueil : la carte « première semaine » rappelle la progression.
await page.goto(BASE + "/", { waitUntil: "networkidle" });
text = await main();
check("accueil : carte « Votre première semaine » avec 1 étape sur 3", text.toLowerCase().includes("votre première semaine") && text.includes("1 étape sur 3"));
await page.screenshot({ path: `${OUT}/11-accueil-nouveau.png` });

// Répondre à la question proposée, puis rejoindre le salon.
await page.goto(BASE + "/bienvenue/premiers-pas", { waitUntil: "networkidle" });
await page.locator("li", { hasText: `Quel bras robotique pour débuter ? ${run}` }).getByRole("link", { name: "Répondre" }).click();
await page.waitForURL(/\/p\//);
check("« Répondre » mène à la publication, section commentaires", page.url().includes("#commentaires"));
await page.goto(BASE + "/bienvenue/premiers-pas", { waitUntil: "networkidle" });
await page.locator("li", { hasText: `Atelier robotique ${run}` }).getByRole("button", { name: "Rejoindre et discuter" }).click();
await page.waitForURL(/\/s\/.*#chat/, { timeout: 15000 });
check("« Rejoindre et discuter » ouvre le chat du salon", true);
await page.goto(BASE + "/bienvenue/premiers-pas", { waitUntil: "networkidle" });
text = await main();
check("progression 2 sur 3 et salon rejoint retiré des suggestions", text.includes("2 sur 3") && !text.includes(`Atelier robotique ${run}`));

// Petits écrans.
for (const width of [390, 320]) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(BASE + "/bienvenue/premiers-pas", { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`« Premiers pas » à ${width} px sans débordement`, overflow <= 0, `${overflow} px`);
  await page.screenshot({ path: `${OUT}/12-premiers-pas-${width}.png`, fullPage: true });
}
check("aucune erreur JavaScript dans la console", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
await browser.close();

// Inscription vers une destination précise : respectée, pas de détour.
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} contrôles réussis.`);
process.exit(failed.length ? 1 : 0);
