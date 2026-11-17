import "server-only";
import type { CurrentUser } from "../auth";
import { fail, json } from "../http";
import type { RoomViewer } from "./permissions.ts";
import type { Outcome } from "./service.ts";

export const viewerOf = (u: CurrentUser): RoomViewer => ({ id: u.id, status: u.status, onboarded: u.onboarded });

// Un refus sur un salon privé inconnu du lecteur reste un 404 : son existence n'est pas révélée.
const STATUS: Record<string, number> = {
  introuvable: 404,
  invalide: 404,
  publication: 404,
  theme: 400,
  droit: 403,
  banni: 403,
  exclu: 403,
  expire: 410,
  expiree: 410,
  revoquee: 410,
};

export function outcomeJson<T extends Record<string, unknown>>(outcome: Outcome<T>, status = 200) {
  if (!outcome.ok) return fail(outcome.message, STATUS[outcome.code] ?? 409, { code: outcome.code });
  const { ok: _ok, ...rest } = outcome;
  return json({ ok: true, ...rest }, status);
}
