// Recette NAVIGATEUR (Chrome) de la série C018, contre un serveur ISOLÉ port 3100. Hors npm test.
// playwright-core hors dépendances : copier ce fichier dans un dossier où il est installé, puis : node navigateur-serie-c018.mjs
// Recette navigateur de la série : brouillons, avatars, réactions, page thème, profil, récap.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3100";
const OUT = process.env.OUT ?? "./captures-c018";
mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const results = [];
const check = (label, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`); };

async function member(handle, displayName, themes = []) {
  let cookie = "";
  const req = async (m, p, b) => { const r = await fetch(BASE + p, { method: m, redirect: "manual", headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...(b ? { "Content-Type": "application/json" } : {}) }, body: b ? JSON.stringify(b) : undefined }); const s = r.headers.get("set-cookie"); if (s) cookie = s.split(";")[0]; let d = null; try { d = await r.json(); } catch {} return { status: r.status, data: d }; };
  const l = await req("POST", "/api/auth/request-link", { email: `${handle}@example.test` }); const u = new URL(l.data.devLink); await req("GET", u.pathname + u.search);
  await req("POST", "/api/onboarding", { handle, displayName, acceptRules: true, themeIds: [] });
  for (const t of themes) await req("POST", "/api/follows", { target: "theme", key: t, follow: true });
  return { req, get cookie() { return cookie; } };
}

const ana = await member(`ana_${run}`, "Ana Martin", ["espace"]);
const html = await (await fetch(BASE + "/publier", { headers: { Cookie: ana.cookie } })).text();
const espaceId = (html.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[^{}]{0,200}?Espace/) ?? [])[1];
const p = await ana.req("POST", "/api/posts", { kind: "question", title: `Quelle mission vers Mars suivre ? ${run}`, body: "Je découvre le sujet.", themeIds: [espaceId] });
const room = await ana.req("POST", "/api/rooms", { name: `Club Espace ${run}`, description: "Missions et lancements.", themeId: espaceId, visibility: "public", format: "chat", postId: null });
await ana.req("POST", `/api/rooms/${room.data.roomId}/messages`, { clientId: "m1", body: "Lancement ce soir !" });
check("données : publication et salon créés", p.status === 201 && room.status === 201);

const bob = await member(`bob_${run}`, "Bob Durand");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const [n, v] = bob.cookie.split("="); await ctx.addCookies([{ name: n, value: v, url: BASE }]);
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
const main = () => page.locator("main").innerText();

// 1. Brouillon : saisie, rechargement, reprise.
await page.goto(BASE + "/publier", { waitUntil: "networkidle" });
await page.fill("#title", `Mon brouillon sur les fusées ${run}`);
await page.fill("#body", "Texte en cours de rédaction.");
await page.waitForTimeout(1200);
check("brouillon : enregistrement automatique annoncé", (await main()).includes("Brouillon enregistré automatiquement"));
await page.reload({ waitUntil: "networkidle" });
check("brouillon : retrouvé après rechargement", (await main()).includes("Brouillon retrouvé") && (await main()).includes(`Mon brouillon sur les fusées ${run}`));
await page.screenshot({ path: `${OUT}/20-brouillon-retrouve.png` });
await page.getByRole("button", { name: "Reprendre" }).click();
check("brouillon : saisie restaurée", (await page.inputValue("#title")) === `Mon brouillon sur les fusées ${run}` && (await page.inputValue("#body")) === "Texte en cours de rédaction.");

// 2. Réactions sur la publication d'Ana + avatars.
await page.goto(`${BASE}/p/${p.data.id}`, { waitUntil: "networkidle" });
const appris = page.getByRole("button", { name: /J'ai appris/ });
await Promise.all([page.waitForResponse((r) => r.url().includes("/reactions") && r.request().method() === "POST"), appris.click()]);
await page.waitForFunction(() => document.querySelector('[aria-label="Réactions"] button[aria-pressed="true"]'), null, { timeout: 5000 });
check("réaction : bouton actif et compteur à 1", (await appris.getAttribute("aria-pressed")) === "true" && (await appris.innerText()).includes("1"));
await page.reload({ waitUntil: "networkidle" });
check("réaction : persistée après rechargement", (await page.getByRole("button", { name: /J'ai appris/ }).getAttribute("aria-pressed")) === "true");
check("avatar de l'autrice affiché (initiales AM)", (await page.locator("article").first().innerText()).includes("AM"));
await page.screenshot({ path: `${OUT}/21-publication-reactions.png` });

// 3. Page thème depuis l'étiquette.
await page.getByRole("link", { name: "Espace", exact: true }).first().click();
await page.waitForURL(/\/theme\/espace/);
let t = await main();
check("page thème : titre, publication, salon et membre actif", t.includes("Espace") && t.includes(`Quelle mission vers Mars suivre ? ${run}`) && t.includes(`Club Espace ${run}`) && t.includes("Ana Martin"));
await page.getByRole("button", { name: "Suivre ce thème" }).click();
await page.waitForFunction(() => document.querySelector("main")?.innerText.includes("Suivi ✓"), null, { timeout: 5000 });
check("page thème : suivre le thème", true);
await page.screenshot({ path: `${OUT}/22-page-theme.png`, fullPage: true });

// 4. Profil enrichi d'Ana.
await page.goto(`${BASE}/m/ana_${run}`, { waitUntil: "networkidle" });
t = await main();
check("profil : statistiques et salon public", /1\s*publication/.test(t) && t.includes(`Club Espace ${run}`) && t.includes("Propriétaire"));
await page.screenshot({ path: `${OUT}/23-profil.png`, fullPage: true });

// 5. Récap : exemple étiqueté fictif, lien depuis l'accueil.
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.getByRole("link", { name: /Découvrir le récap/ }).click();
await page.waitForURL(/\/recap/);
t = await main();
check("récap : exemple clairement marqué fictif", t.toLowerCase().includes("exemple fictif") && t.includes("Le premier vrai récap arrive bientôt"));
check("récap : bouton suivre le récap", await page.getByRole("button", { name: "Suivre le récap" }).isVisible());
await page.screenshot({ path: `${OUT}/24-recap.png`, fullPage: true });

// 6. Petits écrans sur les nouvelles pages.
for (const width of [390, 320]) {
  await page.setViewportSize({ width, height: 800 });
  for (const path of ["/theme/espace", `/m/ana_${run}`, "/recap", `/p/${p.data.id}`]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${width} px ${path.split("/").slice(0, 2).join("/")} sans débordement`, over <= 0, `${over} px`);
  }
}
check("console sans erreur", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} contrôles réussis.`);
