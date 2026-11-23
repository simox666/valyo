// Limite de demandes par adresse IP, tenue en mémoire seulement : rien n'est écrit en base ni sur
// disque (la page Confidentialité s'engage à ne pas enregistrer les adresses IP), et tout s'efface
// au redémarrage. Suffisant tant que le site tourne sur une seule instance.

export function createIpLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return {
    /** Compte cette demande et dit si elle reste dans la limite. Sans adresse connue, on laisse passer. */
    allow(ip: string | null): boolean {
      if (!ip) return true;
      const t = now();
      const recent = (hits.get(ip) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= max) { hits.set(ip, recent); return false; }
      recent.push(t);
      hits.set(ip, recent);
      // Ménage : on ne garde pas indéfiniment les adresses qui ne reviennent plus.
      if (hits.size > 5000) for (const [key, times] of hits) if (!times.some((at) => t - at < windowMs)) hits.delete(key);
      return true;
    },
    size: () => hits.size,
  };
}

/** Adresse du visiteur telle que transmise par l'hébergeur (premier élément de X-Forwarded-For). */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || null;
}
