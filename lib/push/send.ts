import "server-only";
import webpush from "web-push";
import { db } from "../db";
import { claimPending, removeSubscription, subscriptionsOf, type PushMessage } from "./core.ts";

// Envoi réseau des notifications push. Les clés VAPID identifient ce serveur auprès des
// services de push (Apple, Google, Mozilla) : prises dans l'environnement si elles y sont
// (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY), sinon générées une fois et gardées en base.

interface Vapid { publicKey: string; privateKey: string }

declare global {
  // eslint-disable-next-line no-var
  var __valyoVapid: Promise<Vapid> | undefined;
  // eslint-disable-next-line no-var
  var __valyoPushLoop: ReturnType<typeof setInterval> | undefined;
}

async function loadVapid(): Promise<Vapid> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const fresh = webpush.generateVAPIDKeys();
  // La première instance qui écrit gagne ; les autres relisent la même paire.
  await db.query(`INSERT INTO push_keys (public_key, private_key) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [fresh.publicKey, fresh.privateKey]);
  const [row] = await db.query<{ public_key: string; private_key: string }>(`SELECT public_key, private_key FROM push_keys`);
  return { publicKey: row.public_key, privateKey: row.private_key };
}

export function vapid(): Promise<Vapid> {
  globalThis.__valyoVapid ??= loadVapid().catch((error) => { globalThis.__valyoVapid = undefined; throw error; });
  return globalThis.__valyoVapid;
}

/** Envoie ces messages aux appareils abonnés de leurs destinataires ; rend le nombre d'envois acceptés et refusés. */
export async function deliver(messages: PushMessage[]): Promise<{ sent: number; failed: number }> {
  const tally = { sent: 0, failed: 0 };
  if (!messages.length) return tally;
  const keys = await vapid();
  const subject = process.env.VAPID_SUBJECT || process.env.APP_URL || "https://www.valyo.si";
  const subs = await subscriptionsOf(db.query, [...new Set(messages.map((m) => m.userId))]);
  await Promise.all(messages.flatMap((message) =>
    subs.filter((s) => s.user_id === message.userId).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: message.title, body: message.body, url: message.url, tag: message.tag }),
          { vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 3600, urgency: "normal", timeout: 10000 },
        );
        tally.sent++;
      } catch (error) {
        tally.failed++;
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 : l'appareil s'est désabonné (application supprimée, autorisation retirée).
        if (status === 404 || status === 410) await removeSubscription(db.query, s.endpoint).catch(() => {});
        else console.error("[push] envoi refusé :", status ?? (error as Error).message);
      }
    }),
  ));
  return tally;
}

/** Un passage : réserve ce qui est en attente, puis envoie. */
export async function flushPushes(): Promise<number> {
  const messages = await db.transaction((q) => claimPending(q));
  await deliver(messages);
  return messages.length;
}

const INTERVAL_MS = 8000;

/** Boucle d'envoi du serveur web, lancée une fois au démarrage (instrumentation.ts). */
export function startPushLoop(): void {
  if (globalThis.__valyoPushLoop) return;
  let busy = false;
  globalThis.__valyoPushLoop = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await flushPushes(); } catch (error) { console.error("[push] passage en échec :", (error as Error).message); } finally { busy = false; }
  }, INTERVAL_MS);
  globalThis.__valyoPushLoop.unref?.();
}
