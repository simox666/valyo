import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readJson, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { liftBan, sanctionMember, setMemberRole } from "@/lib/rooms/service.ts";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), role: z.enum(["moderator", "member"]) }),
  z.object({ action: z.literal("kick"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("ban"), days: z.union([z.literal(7), z.literal(30), z.null()]), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("liftBan") }),
]);

/** Rôles (propriétaire) et sanctions de salon (propriétaire ou modérateur), D5 §4.2. */
export async function POST(request: Request, context: { params: Promise<{ id: string; userId: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id, userId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(userId)) return fail("Introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  const viewer = viewerOf(guard.user);
  const b = parsed.data;
  if (b.action === "role") return outcomeJson(await setMemberRole(db, viewer, id, userId, b.role));
  if (b.action === "kick") return outcomeJson(await sanctionMember(db, viewer, id, userId, { kind: "kick" }, b.reason));
  if (b.action === "ban") return outcomeJson(await sanctionMember(db, viewer, id, userId, { kind: "ban", days: b.days }, b.reason));
  return outcomeJson(await liftBan(db, viewer, id, userId));
}
