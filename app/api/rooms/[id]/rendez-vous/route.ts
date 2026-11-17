import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { viewerOf } from "@/lib/rooms/http.ts";
import { cancelMeetup, createMeetup } from "@/lib/rooms/meetups.ts";

const bodySchema = z.union([
  z.object({
    title: z.string().trim().min(3, "3 caractères au moins.").max(80, "80 caractères au plus."),
    details: z.string().trim().max(500, "500 caractères au plus.").default(""),
    startsAt: z.iso.datetime({ offset: true }),
  }),
  z.object({ cancel: z.uuid() }),
]);

/** Proposer un rendez-vous de salon, ou en annuler un (propriétaire et modération du salon). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Demande invalide.", 400);
  const outcome = await transaction((q) =>
    "cancel" in parsed.data
      ? cancelMeetup(q, viewerOf(guard.user), id, parsed.data.cancel)
      : createMeetup(q, viewerOf(guard.user), id, parsed.data),
  );
  if (!outcome.ok) return fail(outcome.message, outcome.status);
  return json({ ok: true, ...("meetup" in outcome ? { meetup: outcome.meetup } : {}) }, "cancel" in parsed.data ? 200 : 201);
}
