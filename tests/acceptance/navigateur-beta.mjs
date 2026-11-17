// Recette NAVIGATEUR (Chrome) bêta sur invitation + avis, serveur ISOLÉ port 3100 lancé avec INSCRIPTIONS=invitation ADMIN_EMAILS=porteur-c019@example.test. Hors npm test.
// Recette navigateur : bêta sur invitation + avis des testeurs. Serveur isolé 3100, INSCRIPTIONS=invitation.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3100";
const OUT = "./captures-c019";
mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const results = [];
const check = (label, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`); };

const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/status of 403/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return page;
}
async function signIn(page, email) {
  await page.goto(BASE + "/connexion", { waitUntil: "networkidle" });
  await page.fill("input[type=email]", email);
  await page.getByRole("button", { name: "Recevoir le lien de connexion" }).click();
}

// 1. Inconnu sans invitation : refusé avec explication.
const stranger = await newPage();
await signIn(stranger, `inconnu_${run}@example.test`);
await stranger.getByText("Valyo est pour l’instant sur invitation").waitFor({ timeout: 10000 });
check("inconnu sans invitation : refus expliqué", true);
await stranger.screenshot({ path: `${OUT}/30-refus-sans-invitation.png` });

// 2. Le porteur (ADMIN_EMAILS) entre sans invitation, s'inscrit, crée une invitation.
const owner = await newPage();
await signIn(owner, "porteur-c019@example.test");
await owner.getByRole("link", { name: "Ouvrir le lien de connexion" }).click();
await owner.waitForLoadState("networkidle");
if (owner.url().includes("/bienvenue")) {
  await owner.fill("#handle", `porteur_${run}`);
  await owner.fill("#displayName", "Le Porteur");
  await owner.locator("input[type=checkbox]").last().check();
  await owner.getByRole("button", { name: "Terminer l’inscription" }).click();
  await owner.waitForURL(/premiers-pas|\/$/, { timeout: 15000 });
}
check("porteur (ADMIN_EMAILS) admis sans invitation", true);
await owner.goto(BASE + "/inviter", { waitUntil: "networkidle" });
await owner.fill("input[placeholder^='Ex.']", "Léa, collègue");
await owner.getByRole("button", { name: "Créer un lien d’invitation" }).click();
const code = owner.locator("[role=status] code");
await code.waitFor({ timeout: 10000 });
const link = await code.innerText();
check("lien d'invitation créé et affiché une fois", link.includes("/rejoindre/"));
await owner.screenshot({ path: `${OUT}/31-inviter.png`, fullPage: true });

// 3. La personne invitée arrive par le lien, voit qui l'invite, crée son compte.
const lea = await newPage();
await lea.goto(link, { waitUntil: "networkidle" });
check("page d'invitation : « Le Porteur vous invite »", (await lea.locator("main").innerText()).includes("Le Porteur vous invite sur Valyo"));
await lea.screenshot({ path: `${OUT}/32-rejoindre.png`, fullPage: true });
await lea.fill("input[type=email]", `lea_${run}@example.test`);
await lea.getByRole("button", { name: "Recevoir le lien de connexion" }).click();
await lea.getByRole("link", { name: "Ouvrir le lien de connexion" }).click();
await lea.waitForURL(/\/bienvenue/);
await lea.waitForLoadState("networkidle");
await lea.fill("#handle", `lea_${run}`);
await lea.fill("#displayName", "Léa");
await lea.locator("input[type=checkbox]").last().check();
await lea.getByRole("button", { name: "Terminer l’inscription" }).click();
await lea.waitForURL(/premiers-pas/, { timeout: 15000 });
check("invitée : compte créé, arrivée sur Premiers pas", true);

// 4. Le lien ne sert qu'une fois.
const again = await newPage();
await again.goto(link, { waitUntil: "networkidle" });
check("lien déjà utilisé : « Invitation indisponible »", (await again.locator("main").innerText()).includes("Invitation indisponible"));

// 5. Le porteur voit que Léa a rejoint.
await owner.goto(BASE + "/inviter", { waitUntil: "networkidle" });
const ownerText = await owner.locator("main").innerText();
check("suivi : « A rejoint Valyo » avec le nom de Léa", ownerText.includes("A rejoint Valyo") && ownerText.includes("Léa"));

// 6. Avis de Léa, lu par le porteur.
await lea.goto(BASE + "/avis?page=/salons", { waitUntil: "networkidle" });
await lea.getByText("Quelque chose ne marche pas").click();
await lea.fill("textarea", "Le bouton Rejoindre met du temps à répondre.");
await lea.getByRole("button", { name: "Envoyer mon avis" }).click();
await lea.getByText("Merci, c’est bien reçu !").waitFor({ timeout: 10000 });
check("avis envoyé", true);
await owner.goto(BASE + "/admin/avis", { waitUntil: "networkidle" });
const avisText = await owner.locator("main").innerText();
check("administration : avis visible avec type et page", avisText.includes("Le bouton Rejoindre met du temps") && avisText.includes("/salons"));
await owner.getByRole("button", { name: "Marquer traité" }).click();
await owner.getByRole("button", { name: "Rouvrir" }).waitFor({ timeout: 5000 });
check("avis marqué traité", true);
await owner.screenshot({ path: `${OUT}/33-avis-admin.png`, fullPage: true });

// 7. Santé et petits écrans.
check("point de santé /api/sante", (await (await fetch(BASE + "/api/sante")).json()).ok === true);
for (const width of [320, 390]) {
  for (const path of ["/inviter", "/avis"]) {
    await owner.setViewportSize({ width, height: 800 });
    await owner.goto(BASE + path, { waitUntil: "networkidle" });
    const over = await owner.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${width} px ${path} sans débordement`, over <= 0, `${over} px`);
  }
  await again.setViewportSize({ width, height: 800 });
  await again.goto(link, { waitUntil: "networkidle" });
  const over = await again.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${width} px /rejoindre sans débordement`, over <= 0, `${over} px`);
}
check("console sans erreur", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} contrôles réussis.`);
