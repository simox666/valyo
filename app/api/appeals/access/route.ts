import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, sameOrigin } from "@/lib/http";
import { limitMessage, runLimited } from "@/lib/limits";
import { createAppealToken } from "@/lib/social/moderation.ts";

const bodySchema = z.object({ email: z.email().max(254) });

/**
 * Accès de contestation pour un compte BANNI (ACC09) : un jeton court, envoyé à
 * l'adresse du compte, ouvre la seule page /contestation — jamais une session.
 * La réponse est GÉNÉRIQUE : elle ne révèle pas si l'adresse correspond à un compte
 * banni. Limite partagée avec les demandes de lien de connexion (5/heure/adresse).
 * En développement sans service d'e-mail, le lien est renvoyé directement (comme la connexion).
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Requête refusée.", 403);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Adresse e-mail invalide.", 400);
  if (process.env.NODE_ENV === "production" && !process.env.RESEND_API_KEY) {
    return fail("Le service d'envoi est indisponible. Réessayez plus tard.", 503);
  }
  const limited = await runLimited(transaction, "loginLink", parsed.data.email, (q) => createAppealToken(q, parsed.data.email));
  if (!limited.ok) return fail(limitMessage("loginLink", limited.rule), 429);
  const result = limited.value;
  let devLink: string | undefined;
  if (result) {
    const link = `/contestation?token=${encodeURIComponent(result.token)}`;
    try {
      const { sendAppealLink } = await import("@/lib/email");
      const origin = process.env.APP_URL || new URL(request.url).origin;
      ({ devLink } = await sendAppealLink(parsed.data.email, `${origin}${link}`));
    } catch {
      return fail("L'e-mail n'a pas pu être envoyé. Réessayez plus tard.", 502);
    }
  }
  return json({ ok: true, message: "Si cette adresse correspond à un compte banni, un lien de contestation vient de lui être envoyé.", devLink });
}
