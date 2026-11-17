import { z } from "zod";
import { transaction } from "@/lib/db";
import { bigintReplacer, loadConfig, logRevision, policyProblems } from "@/lib/editorial/config.ts";
import { isValidTimeZone } from "@/lib/editorial/time.ts";
import { fail, json, readJson, requireAdmin } from "@/lib/http";

// Mise à jour tracée de la configuration de l'agent (contrat §1, §7, §8).
// Le mode public est refusé dans le lot 2A ; les politiques D8 ne sont jamais préremplies.

const decimalToMicros = (value: string) => {
  const [units, fraction = ""] = value.split(".");
  return BigInt(units) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
};

const bodySchema = z.object({
  reason: z.string().trim().min(3, "Indiquez le motif de la modification.").max(300),
  paused: z.boolean().optional(),
  mode: z.enum(["draft", "public"]).optional(),
  provider: z.enum(["none", "test", "claude"]).optional(),
  model: z.string().trim().max(100).nullable().optional(),
  prices: z
    .object({ inputPerMTokMicros: z.number().int().positive().max(1e12), outputPerMTokMicros: z.number().int().positive().max(1e12) })
    .nullable()
    .optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "Code de devise sur trois lettres (USD, EUR…).").nullable().optional(),
  budgetCap: z.string().trim().regex(/^\d{1,9}(\.\d{1,6})?$/, "Montant décimal, par exemple 80.00.").nullable().optional(),
  timezone: z.string().trim().refine(isValidTimeZone, "Fuseau inconnu (exemple : Europe/Brussels).").nullable().optional(),
  policy: z
    .object({
      slots: z.array(z.object({ weekday: z.number().int().min(1).max(7), time: z.string() })).min(1).max(14),
      maxItems: z.number().int(),
      prepLeadHours: z.number().int(),
    })
    .nullable()
    .optional(),
  clearEstimationBlock: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Requête invalide.", 400, { field: issue?.path.join(".") });
  }
  const b = parsed.data;
  if (b.mode === "public") return fail("Le mode public n'est pas disponible dans le lot 2A (activation : lot 2C).", 409);
  if (b.policy) {
    const problems = policyProblems(b.policy);
    if (problems.length) return fail(`Politique incomplète : ${problems.join(" ; ")}`, 400, { field: "policy" });
  }

  const config = await transaction(async (q) => {
    const before = await loadConfig(q, { lock: true });
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (b.paused !== undefined) set("paused", b.paused);
    if (b.mode !== undefined) set("mode", b.mode);
    if (b.provider !== undefined) set("provider", b.provider);
    if (b.model !== undefined) set("model", b.model || null);
    if (b.prices !== undefined) set("prices", b.prices === null ? null : JSON.stringify(b.prices));
    if (b.currency !== undefined) set("currency", b.currency || null);
    if (b.budgetCap !== undefined) set("budget_cap_micros", b.budgetCap === null ? null : decimalToMicros(b.budgetCap).toString());
    if (b.timezone !== undefined) set("timezone", b.timezone || null);
    if (b.policy !== undefined) set("policy", b.policy === null ? null : JSON.stringify(b.policy));
    if (b.clearEstimationBlock) set("estimation_blocked", false);
    params.push(guard.user.id);
    await q(
      `UPDATE editorial_config SET ${[...sets, `version = version + 1`, `updated_at = now()`, `updated_by = $${params.length}`].join(", ")} WHERE id = 1`,
      params,
    );
    const after = await loadConfig(q);
    await logRevision(q, {
      entity: "config",
      entityId: "1",
      before,
      after,
      reason: b.reason,
      actorId: guard.user.id,
      actorLabel: guard.user.handle ?? "administrateur",
    });
    return after;
  });
  return json(JSON.parse(JSON.stringify({ ok: true, version: config.version }, bigintReplacer)));
}
