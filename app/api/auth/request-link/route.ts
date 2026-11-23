import { z } from "zod";
import { createLoginToken, safeNextPath } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { sendLoginLink } from "@/lib/email";
import { fail, json, readJson, sameOrigin } from "@/lib/http";
import { limitMessage, runLimited } from "@/lib/limits";
import { signupDecision } from "@/lib/social/invitations.ts";
import { clientIp, createIpLimiter } from "@/lib/ip-limit.ts";

// Inscriptions ouvertes : sans cette limite, un robot pourrait faire envoyer des e-mails de connexion
// à des milliers d'adresses depuis le même poste (la limite par adresse e-mail ne l'arrête pas).
const perIp = createIpLimiter(Math.max(1, Number.parseInt(process.env.LIMIT_LOGIN_LINKS_PER_IP_PER_HOUR ?? "", 10) || 10), 60 * 60 * 1000);

const bodySchema = z.object({
  email: z.email("Adresse e-mail invalide.").max(254),
  next: z.string().optional(),
  /** Bêta sur invitation : jeton d'invitation à la plateforme, porté jusqu'à la création du compte. */
  invitation: z.string().max(128).optional(),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Requête refusée.", 403);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Adresse e-mail invalide.", 400, { fields: { email: "Adresse e-mail invalide." } });

  if (!perIp.allow(clientIp(request))) return fail("Trop de demandes de lien depuis votre connexion. Réessayez dans une heure.", 429);

  const email = parsed.data.email.trim();
  const limited = await runLimited(transaction, "loginLink", email, async (q) => {
    const decision = await signupDecision(q, email, parsed.data.invitation ?? null);
    if (!decision.allowed) return null;
    return createLoginToken(email, safeNextPath(parsed.data.next), q, decision.invitationId);
  });
  if (!limited.ok) return fail(limitMessage("loginLink", limited.rule), 429);
  if (limited.value === null) {
    return fail(
      "Valyo est pour l’instant sur invitation. Demandez un lien d’invitation à un membre, ou utilisez l’adresse avec laquelle vous avez été invité·e.",
      403,
      { invitationRequired: true },
    );
  }

  const origin = process.env.APP_URL || new URL(request.url).origin;
  const link = `${origin}/api/auth/verify?token=${encodeURIComponent(limited.value)}`;
  try {
    const { devLink } = await sendLoginLink(email, link);
    return json({ ok: true, devLink });
  } catch (error) {
    console.error(error);
    return fail("L'e-mail n'a pas pu être envoyé. Réessayez dans quelques minutes.", 502);
  }
}
