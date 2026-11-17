import type { Query } from "../editorial/types.ts";
import { activeContributor } from "../community-locks.ts";

// Blocage entre membres (lot d'accélération D31 ; spec F15 partielle).
// Effets livrés :
// - les publications et commentaires publics du membre bloqué sont MASQUÉS pour le bloqueur ;
// - aucune notification du bloqué vers le bloqueur ;
// - une invitation créée par le bloqué ne peut pas être acceptée par le bloqueur ;
// - LIMITE affichée : dans un salon partagé, les messages du bloqué restent visibles
//   (le chat est une conversation de groupe ; l'interface le dit au moment du blocage).

export type BlockOutcome = { ok: true } | { ok: false; message: string };

export async function setBlock(q: Query, blockerId: string, blockedId: string, blocked: boolean): Promise<BlockOutcome> {
  if (!(await activeContributor(q, blockerId))) return { ok: false, message: "Compte non autorisé à modifier les blocages." };
  if (blockerId === blockedId) return { ok: false, message: "On ne se bloque pas soi-même." };
  if (!blocked) {
    await q(`DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]);
    return { ok: true };
  }
  const [target] = await q<{ role: string }>(`SELECT role FROM users WHERE id = $1 AND status <> 'deleted'`, [blockedId]);
  if (!target) return { ok: false, message: "Membre introuvable." };
  if (target.role === "agent") return { ok: false, message: "L'agent éditorial ne se bloque pas ; signalez plutôt un contenu fautif." };
  await q(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [blockerId, blockedId]);
  return { ok: true };
}

export async function isBlocking(q: Query, blockerId: string, blockedId: string): Promise<boolean> {
  return (await q(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId])).length > 0;
}

/** Auteurs masqués pour ce lecteur (filtre des fils et commentaires). */
export async function blockedIdsFor(q: Query, viewerId: string): Promise<string[]> {
  const rows = await q<{ blocked_id: string }>(`SELECT blocked_id FROM user_blocks WHERE blocker_id = $1`, [viewerId]);
  return rows.map((r) => r.blocked_id);
}
