// Notifications push : abonnements des appareils et file d'envoi. Tout ce qui est ici est
// pur SQL (testable sur PGlite) ; l'envoi réseau lui-même est dans send.ts.
//
// File d'envoi : une notification ou un message privé dont `pushed_at` est nul n'a pas
// encore été poussé. `claimPending` les réserve (FOR UPDATE SKIP LOCKED : deux instances
// ne poussent jamais deux fois la même chose) et rend les messages à envoyer.
//
// Discrétion : un push s'affiche sur un écran verrouillé. On y met qui et où, jamais le
// contenu d'un message privé ni le motif d'une décision de modération.

import type { Query } from "../editorial/types.ts";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  userId: string;
  title: string;
  body: string;
  /** Page ouverte au toucher. */
  url: string;
  /** Deux push de même étiquette se remplacent sur l'appareil au lieu de s'empiler. */
  tag: string;
}

// Seuls les services de push des navigateurs sont acceptés : le serveur ne doit jamais
// pouvoir être amené à écrire vers une adresse arbitraire fournie par un membre.
const PUSH_HOSTS = [".googleapis.com", ".push.apple.com", ".mozilla.com", ".notify.windows.com"];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && endpoint.length <= 1000 && PUSH_HOSTS.some((suffix) => url.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

/** Abonne cet appareil ; s'il était abonné pour un autre compte (appareil partagé), il change de propriétaire. */
export async function saveSubscription(q: Query, userId: string, sub: PushSubscriptionInput): Promise<void> {
  await q(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth],
  );
}

export async function removeSubscription(q: Query, endpoint: string, userId?: string): Promise<void> {
  if (userId) await q(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [endpoint, userId]);
  else await q(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

export async function subscriptionsOf(q: Query, userIds: string[]): Promise<{ user_id: string; endpoint: string; p256dh: string; auth: string }[]> {
  if (!userIds.length) return [];
  return q(`SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::uuid[])`, [userIds]);
}

// Au-delà de ce délai (redémarrage, panne), on n'envoie plus : un push en retard d'une heure dérange sans servir.
const FRESH = `interval '30 minutes'`;
const BATCH = 100;

type NotificationRow = {
  id: string; user_id: string; kind: string; post_id: string | null; room_id: string | null;
  actor_name: string | null; room_name: string | null; post_title: string | null;
};

function notificationMessage(n: NotificationRow): PushMessage {
  const who = n.actor_name || "Un membre";
  const post = n.post_title ? `« ${n.post_title.slice(0, 80)} »` : "votre publication";
  const base = { userId: n.user_id, tag: `n-${n.id}` };
  switch (n.kind) {
    case "reply": return { ...base, title: `${who} vous a répondu`, body: post, url: `/p/${n.post_id}` };
    case "best_answer": return { ...base, title: "Votre réponse a été retenue", body: `${who} l’a choisie comme meilleure réponse à ${post}.`, url: `/p/${n.post_id}` };
    case "relay": return { ...base, title: `${who} a relayé votre publication`, body: post, url: `/p/${n.post_id}` };
    case "mention": return n.room_id
      ? { ...base, title: `${who} vous a mentionné`, body: `Dans le salon ${n.room_name ?? ""}`.trim(), url: `/s/${n.room_id}` }
      : { ...base, title: `${who} vous a mentionné`, body: post, url: `/p/${n.post_id}` };
    case "room_message": return { ...base, tag: `salon-${n.room_id}`, title: n.room_name ?? "Salon", body: `Nouveau message de ${who}`, url: `/s/${n.room_id}` };
    default: return { ...base, title: "Valyo", body: "Une décision de modération vous concerne.", url: "/notifications" };
  }
}

/** Réserve ce qui reste à pousser et rend les messages correspondants (destinataires actifs, éléments récents et non lus). */
export async function claimPending(q: Query): Promise<PushMessage[]> {
  const messages: PushMessage[] = [];

  const claimed = await q<{ id: string }>(
    `UPDATE notifications SET pushed_at = now()
     WHERE id IN (SELECT id FROM notifications WHERE pushed_at IS NULL ORDER BY created_at LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)
     RETURNING id`,
  );
  if (claimed.length) {
    const rows = await q<NotificationRow>(
      `SELECT n.id, n.user_id, n.kind, n.post_id, n.room_id, a.display_name AS actor_name, r.name AS room_name, p.title AS post_title
       FROM notifications n
       JOIN users u ON u.id = n.user_id AND u.status = 'active'
       LEFT JOIN users a ON a.id = n.actor_id
       LEFT JOIN rooms r ON r.id = n.room_id
       LEFT JOIN posts p ON p.id = n.post_id
       WHERE n.id = ANY($1::uuid[]) AND n.read_at IS NULL AND n.created_at > now() - ${FRESH}
       ORDER BY n.created_at`,
      [claimed.map((c) => c.id)],
    );
    messages.push(...rows.map(notificationMessage));
  }

  const dms = await q<{ id: string }>(
    `UPDATE direct_messages SET pushed_at = now()
     WHERE id IN (SELECT id FROM direct_messages WHERE pushed_at IS NULL ORDER BY created_at LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)
     RETURNING id`,
  );
  if (dms.length) {
    // Un seul push par expéditeur et par destinataire, même pour une rafale de messages.
    const rows = await q<{ recipient_id: string; sender_handle: string | null; sender_name: string | null; n: number }>(
      `SELECT CASE WHEN c.user_a = m.sender_id THEN c.user_b ELSE c.user_a END AS recipient_id,
              s.handle AS sender_handle, s.display_name AS sender_name, count(*)::int AS n
       FROM direct_messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN users s ON s.id = m.sender_id
       JOIN users u ON u.id = CASE WHEN c.user_a = m.sender_id THEN c.user_b ELSE c.user_a END AND u.status = 'active'
       WHERE m.id = ANY($1::uuid[]) AND m.created_at > now() - ${FRESH}
       GROUP BY 1, 2, 3`,
      [dms.map((d) => d.id)],
    );
    for (const r of rows) {
      messages.push({
        userId: r.recipient_id,
        title: r.sender_name || "Un membre",
        body: r.n > 1 ? `${r.n} nouveaux messages privés` : "Vous a envoyé un message privé",
        url: r.sender_handle ? `/messages/${r.sender_handle}` : "/messages",
        tag: `mp-${r.sender_handle ?? "membre"}`,
      });
    }
  }
  return messages;
}
