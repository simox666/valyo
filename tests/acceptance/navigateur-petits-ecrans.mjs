// Recette NAVIGATEUR réelle (Chrome installé), contre un serveur ISOLÉ sur le port 3100
// (copie du dépôt sans .env.local, base PGlite dédiée). Non inclus dans npm test.
// playwright-core n'est pas une dépendance du projet : l'installer dans un dossier à part,
// copier ce fichier dans ce dossier, puis y lancer : OUT=./captures node navigateur-petits-ecrans.mjs (imports ESM : NODE_PATH ne suffit pas)
// Contrôle petits écrans : débordement horizontal et libellés de navigation coupés.
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const run = Date.now().toString(36);
let cookie = "";
const req = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, redirect: "manual", headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = res.headers.get("set-cookie"); if (set) cookie = set.split(";")[0];
  let data = null; try { data = await res.json(); } catch {} return { status: res.status, data };
};
const link = await req("POST", "/api/auth/request-link", { email: `ecran_${run}@example.test`, next: "/" });
const u = new URL(link.data.devLink); await req("GET", u.pathname + u.search);
await req("POST", "/api/onboarding", { handle: `ecran_${run}`, displayName: "Écran", acceptRules: true, themeIds: [] });
const html = await (await fetch(BASE + "/publier", { headers: { Cookie: cookie } })).text();
const themeId = html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)[0];
const post = await req("POST", "/api/posts", { kind: "question", title: `Question petits écrans ${run}`, body: "Contexte de la question.", themeIds: [themeId] });
const room = await req("POST", "/api/rooms", { name: `Salon petits écrans ${run}`, description: "Test d'affichage", themeId, visibility: "public", format: "chat", postId: post.data.id });
await req("POST", `/api/rooms/${room.data.roomId}/messages`, { clientId: "m1", body: "Un message avec un lien https://exemple.test/une-adresse-tres-longue-qui-ne-doit-pas-deborder-de-la-bulle" });

const pages = ["/", "/salons", "/recherche?q=salon", "/notifications", `/p/${post.data.id}`, `/s/${room.data.roomId}`, `/salons/nouveau?post=${post.data.id}`, "/publier", "/sanctions"];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const [n, v] = cookie.split("=");
let failures = 0;
for (const width of [320, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  await context.addCookies([{ name: n, value: v, url: BASE }]);
  const page = await context.newPage();
  for (const path of pages) {
    await page.goto(BASE + path, { waitUntil: "load" }); await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const wrapped = [...document.querySelectorAll('nav[aria-label="Navigation principale"] a')]
        .filter((a) => a.getBoundingClientRect().height > 44 || a.scrollWidth > a.clientWidth + 1)
        .map((a) => a.textContent.trim());
      const wide = [...document.querySelectorAll("main *")]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
      return { overflow, wrapped, wide };
    });
    const ok = r.overflow <= 0 && r.wrapped.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "✔" : "✘"} ${width}px ${path.split("?")[0]} — débordement ${r.overflow}px${r.wrapped.length ? `, libellés coupés : ${r.wrapped.join(", ")}` : ""}${r.wide.length ? `, éléments larges : ${r.wide.join(", ")}` : ""}`);
    if (path.startsWith("/s/") || path === "/") await page.screenshot({ path: `captures-c017/ecran-${width}${path === "/" ? "-accueil" : "-salon"}.png`, fullPage: false });
  }
  await context.close();
}
await browser.close();
console.log(failures ? `${failures} problème(s)` : "Aucun débordement.");
process.exit(failures ? 1 : 0);
