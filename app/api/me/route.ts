import { activeContributor } from "@/lib/community-locks.ts";
import { cookies } from "next/headers";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { deleteAccount, writeFollowedThemes } from "@/lib/data/members";
import { fail, json, readJson, requireContributor, sameOrigin } from "@/lib/http";
import { fieldErrors, profileSchema } from "@/lib/validation";
import { ownsFreeImage } from "@/lib/media";

/** Identité du compte connecté (sans adresse e-mail). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Connectez-vous pour continuer.", 401);
  return json({ ok: true, id: user.id, handle: user.handle, displayName: user.displayName, status: user.status, onboarded: user.onboarded });
}

export async function PATCH(request: Request) {
  // Modifier son profil public est une contribution : refusée à un compte suspendu (A001).
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { user } = guard;

  const parsed = profileSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Vérifiez les champs indiqués.", 400, { fields: fieldErrors(parsed.error) });

  const d = parsed.data;
  const specialties = d.specialties ? [...new Set(d.specialties.map((x) => x.trim()).filter(Boolean))] : null;
  const saved = await transaction(async (q) => {
    if (!(await activeContributor(q, user.id))) return false;
    for (const id of [d.avatarImageId, d.bannerImageId]) if (id && !(await ownsFreeImage(q, user.id, id))) return false;
    await q(
      `UPDATE users SET display_name = $2, bio = $3,
              headline = COALESCE($4, headline), specialties = COALESCE($5, specialties), links = COALESCE($6, links),
              ask_me = COALESCE($7, ask_me), looking_for = COALESCE($8, looking_for),
              avatar_image_id = CASE WHEN $9 THEN $10::uuid ELSE avatar_image_id END,
              banner_image_id = CASE WHEN $11 THEN $12::uuid ELSE banner_image_id END
       WHERE id = $1`,
      [
        user.id, d.displayName, d.bio, d.headline ?? null, specialties, d.links ? d.links.map((l) => l.trim()) : null,
        d.askMe ?? null, d.lookingFor ?? null,
        d.avatarImageId !== undefined, d.avatarImageId ?? null, d.bannerImageId !== undefined, d.bannerImageId ?? null,
      ],
    );
    await writeFollowedThemes(q, user.id, parsed.data.themeIds);
    return true;
  });
  if (!saved) return fail("Modification non autorisée.", 403);
  return json({ ok: true });
}

// La suppression de son compte reste possible même suspendu.
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail("Requête refusée.", 403);
  const user = await getCurrentUser();
  if (!user) return fail("Connectez-vous pour continuer.", 401);
  const body = (await readJson(request)) as { confirm?: unknown } | null;
  if (body?.confirm !== "SUPPRIMER") return fail("Tapez SUPPRIMER pour confirmer.", 400, { fields: { confirm: "Tapez SUPPRIMER pour confirmer." } });

  const result = await deleteAccount(user.id);
  if (!result.ok) {
    return fail(
      `Vous possédez ${result.rooms.length} salon(s) actif(s) (${result.rooms.map((r) => r.name).join(", ")}) : transférez la propriété ou archivez-les avant de supprimer votre compte.`,
      409,
      { rooms: result.rooms },
    );
  }
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
}
