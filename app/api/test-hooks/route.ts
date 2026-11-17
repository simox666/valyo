import { z } from "zod";
import { transaction } from "@/lib/db";
import { renderRecapBody } from "@/lib/editorial/publish.ts";
import { fail, json, readJson } from "@/lib/http";
import { normalizeUrl } from "@/lib/urls";

// Point d'accès réservé aux tests de bout en bout. Inexistant (404) sauf si
// VALYO_TEST_HOOKS=1 hors production. Usage restant :
// - semer un récapitulatif PUBLIÉ de DÉMONSTRATION (données fictives marquées
//   comme telles) pour la recette du rendu public (lot d'accélération A9),
//   sans passer par la capacité de publication, qui reste désactivée.
// Le changement de statut de compte a été RETIRÉ (D36) : la recette passe par
// l'API de modération réelle (suspension, bannissement, levée).

const bodySchema = z.object({ action: z.literal("seed-demo-recap") });

function enabled() {
  return process.env.VALYO_TEST_HOOKS === "1" && process.env.NODE_ENV !== "production";
}

const DEMO_ITEMS = [
  {
    title: "Démonstration : un robot de tri présenté par un institut fictif",
    summary: "Donnée de démonstration, sans source réelle : un institut fictif présente un robot qui trie 1200 composants par heure.",
    scientific_status: "announcement",
    sources: [{ url: "https://demo.invalid/annonce-robot", title: "Annonce fictive" }],
  },
  {
    title: "Démonstration : une prépublication fictive sur les batteries",
    summary: "Donnée de démonstration, sans source réelle : une équipe fictive décrit une batterie expérimentale dans une prépublication non relue.",
    scientific_status: "preprint",
    sources: [{ url: "https://demo.invalid/prepublication-batterie", title: "Prépublication fictive" }],
  },
];

async function seedDemoRecap() {
  return transaction(async (q) => {
    const [agent] = await q<{ id: string }>(`SELECT id FROM users WHERE role = 'agent' ORDER BY created_at LIMIT 1`);
    const [post] = await q<{ id: string }>(
      `INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', $2, $3) RETURNING id`,
      [agent.id, "Démonstration : récapitulatif sciences et tech", renderRecapBody(DEMO_ITEMS)],
    );
    let position = 0;
    for (const item of DEMO_ITEMS) {
      for (const s of item.sources) {
        await q(`INSERT INTO post_sources (post_id, position, url, normalized_url) VALUES ($1, $2, $3, $4)`, [post.id, position++, s.url, normalizeUrl(s.url)]);
      }
    }
    const [recap] = await q<{ id: string }>(
      `INSERT INTO editorial_recaps (slot_key, slot_at, state, post_id) VALUES ($1, now(), 'published', $2) RETURNING id`,
      [`demo-${post.id.slice(0, 8)}`, post.id],
    );
    for (let i = 0; i < DEMO_ITEMS.length; i++) {
      const item = DEMO_ITEMS[i];
      const [subject] = await q<{ id: string }>(
        `INSERT INTO editorial_subjects (group_key, title, status, recap_id) VALUES ($1, $2, 'ready', $3) RETURNING id`,
        [`demo-${post.id.slice(0, 8)}-${i}`, item.title, recap.id],
      );
      await q(
        `INSERT INTO editorial_recap_items (recap_id, subject_id, position, title, summary, scientific_status, sources, claims)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '{"statements":[],"simulated":true}')`,
        [recap.id, subject.id, i + 1, item.title, item.summary, item.scientific_status, JSON.stringify(item.sources)],
      );
    }
    return { postId: post.id, recapId: recap.id };
  });
}

export async function POST(request: Request) {
  if (!enabled()) return fail("Introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  return json({ ok: true, ...(await seedDemoRecap()) });
}
