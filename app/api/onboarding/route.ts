import { activeContributor } from "@/lib/community-locks.ts";
import { transaction } from "@/lib/db";
import { isHandleTaken, writeFollowedThemes } from "@/lib/data/members";
import { fail, json, readJson, requireActiveUser } from "@/lib/http";
import { fieldErrors, onboardingSchema } from "@/lib/validation";

export async function POST(request: Request) {
  // Un compte suspendu ne peut pas terminer son inscription, qui crée un profil public.
  const guard = await requireActiveUser(request, { allowOnboarding: true });
  if (guard.response) return guard.response;
  const { user } = guard;
  if (user.onboarded) return fail("Votre inscription est déjà terminée.", 409);

  const parsed = onboardingSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Vérifiez les champs indiqués.", 400, { fields: fieldErrors(parsed.error) });
  const { handle, displayName, themeIds } = parsed.data;

  if (await isHandleTaken(handle, user.id)) {
    return fail("Ce pseudonyme est déjà pris.", 409, { fields: { handle: "Ce pseudonyme est déjà pris." } });
  }
  try {
    const saved = await transaction(async (q) => {
      if (!(await activeContributor(q, user.id, true))) return false;
      const rows = await q(`UPDATE users SET handle = $2, display_name = $3, rules_accepted_at = now()
        WHERE id = $1 AND rules_accepted_at IS NULL RETURNING id`, [user.id, handle, displayName]);
      if (!rows.length) return false;
      await writeFollowedThemes(q, user.id, themeIds);
      return true;
    });
    if (!saved) return fail("Inscription non autorisée ou déjà terminée.", 403);
  } catch {
    // Course entre deux inscriptions simultanées sur le même pseudonyme : l'index unique tranche.
    return fail("Ce pseudonyme est déjà pris.", 409, { fields: { handle: "Ce pseudonyme est déjà pris." } });
  }
  return json({ ok: true, handle });
}
