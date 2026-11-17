import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { setBlock } from "@/lib/social/blocks.ts";

const bodySchema = z.object({ userId: z.uuid(), blocked: z.boolean() });

/** Bloquer ou débloquer un membre (D31). */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  const outcome = await transaction((q) => setBlock(q, guard.user.id, parsed.data.userId, parsed.data.blocked));
  return outcome.ok ? json({ ok: true }) : fail(outcome.message, 409);
}
