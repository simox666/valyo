interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const PER_IP_LIMIT = 10;
const GLOBAL_LIMIT = 200;
const SWEEP_INTERVAL = 500; // opportunistic cleanup, see sweepExpired below

const ipBuckets = new Map<string, Bucket>();
let globalBucket: Bucket = { count: 0, resetAt: Date.now() + WINDOW_MS };
let callsSinceSweep = 0;

function freshBucket(now: number): Bucket {
  return { count: 0, resetAt: now + WINDOW_MS };
}

// The per-IP map only grows — nothing ever removes an entry whose window
// has long since expired. Fine for a short pilot, but left unbounded it's a
// slow leak on a long-lived process. Cheap opportunistic sweep instead of a
// timer, so it costs nothing when the endpoint is idle.
function sweepExpired(now: number) {
  for (const [key, bucket] of ipBuckets) {
    if (now >= bucket.resetAt) ipBuckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

// In-memory only: correct on a single long-lived Node process (e.g. `next
// start` on one instance), NOT correct across multiple serverless instances
// or after a cold start — Vercel functions don't share memory. This is a
// stopgap for a small pilot on one instance (project.md R3); replace with a
// shared store (e.g. Upstash Redis) before scaling past that.
//
// `ip` is read from the client-supplied x-forwarded-for header — trustworthy
// only behind a proxy that sets/overwrites it itself (Vercel does). Exposed
// directly on plain Node, a client can spoof it to dodge the per-IP limit
// entirely; the global limit is the only backstop in that deployment shape,
// and it's still not a real access-control mechanism (project.md C2).
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();

  if (++callsSinceSweep >= SWEEP_INTERVAL) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  const ipStored = ipBuckets.get(ip);
  const ipCurrent = !ipStored || now >= ipStored.resetAt ? freshBucket(now) : ipStored;

  // A request already rejected by its own IP limit must not also consume
  // shared global capacity that other clients depend on — check and reject
  // before touching the global bucket at all.
  if (ipCurrent.count >= PER_IP_LIMIT) {
    ipBuckets.set(ip, ipCurrent);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((ipCurrent.resetAt - now) / 1000)) };
  }
  ipCurrent.count += 1;
  ipBuckets.set(ip, ipCurrent);

  globalBucket = now >= globalBucket.resetAt ? freshBucket(now) : globalBucket;
  if (globalBucket.count >= GLOBAL_LIMIT) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((globalBucket.resetAt - now) / 1000)) };
  }
  globalBucket.count += 1;

  return { ok: true, retryAfterSeconds: 0 };
}
