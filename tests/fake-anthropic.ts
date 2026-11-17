// FAUSSE API Anthropic pour les tests de contrat de l'adaptateur Claude.
// Réponses HTTP SYNTHÉTIQUES, construites d'après la documentation officielle
// (docs/sources-api-claude.md). Aucune requête ne quitte la machine ; aucune
// génération réelle. Les compteurs `request_counts` sont cohérents avec les
// résultats, sauf altération explicitement demandée par un test.

export interface FakeCall {
  method: string;
  path: string;
  body: Record<string, any> | null;
}

/** Altérations de la lecture des résultats (revue C201), appliquées aux N premières lectures. */
export interface ResultTamper {
  kind: "vide" | "tronque" | "doublon" | "inconnu" | "compteur" | "usage";
  times?: number;
}

export interface FakeOptions {
  /** Réponse d'erreur forcée, par clé « MÉTHODE chemin-normalisé » (ex. "POST /v1/messages/batches"). */
  failures?: Record<string, { status: number; type: string } | "network">;
  /** Nombre d'échecs successifs pour chaque clé de `failures` (par défaut : toujours). */
  failureCount?: Record<string, number>;
  /** Jetons renvoyés par le comptage. */
  countTokens?: number;
  /** Limite d'entrée renvoyée par l'API des modèles (null : inconnue). */
  maxInputTokens?: number | null;
  /** Lots encore en cours au premier `retrieve`. */
  inProgressOnce?: boolean;
  tamper?: ResultTamper;
  /** Appelé avant de répondre à chaque requête (ex. modifier la configuration pendant le comptage). */
  onRequest?: (key: string) => Promise<void> | void;
  /** Construit le résultat d'une requête du lot à partir de son custom_id et de ses paramètres. */
  respond: (customId: string, params: Record<string, any>) => Promise<FakeResult> | FakeResult;
}

export type FakeResult =
  | { type: "succeeded"; text: string; stop_reason?: string; category?: string; usage?: { input_tokens: number; output_tokens: number } }
  | { type: "errored"; errorType: string }
  | { type: "canceled" | "expired" };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_synthetique", ...headers } });

export function createFakeAnthropic(options: FakeOptions) {
  const calls: FakeCall[] = [];
  const batches = new Map<string, { requests: { custom_id: string; params: Record<string, any> }[]; retrieved: number; results?: FakeResult[] }>();
  const failuresLeft = { ...(options.failureCount ?? {}) };
  let tamperLeft = options.tamper ? (options.tamper.times ?? Infinity) : 0;
  let next = 0;

  async function resultsOf(batch: { requests: { custom_id: string; params: Record<string, any> }[]; results?: FakeResult[] }) {
    if (!batch.results) batch.results = await Promise.all(batch.requests.map((r) => options.respond(r.custom_id, r.params)));
    return batch.results;
  }

  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const rawBody = init?.body ?? null;
    const body = typeof rawBody === "string" && rawBody ? JSON.parse(rawBody) : null;
    calls.push({ method, path: url.pathname, body });
    const key = `${method} ${url.pathname.replace(/msgbatch_\w+/, ":id")}`;
    await options.onRequest?.(key);

    const failure = options.failures?.[key];
    if (failure && (failuresLeft[key] === undefined || failuresLeft[key]-- > 0)) {
      if (failure === "network") throw new TypeError("fetch failed (coupure réseau synthétique)");
      return json(failure.status, { type: "error", error: { type: failure.type, message: "erreur synthétique" } }, { "retry-after-ms": "0" });
    }

    if (method === "GET" && url.pathname.startsWith("/v1/models/")) {
      const id = decodeURIComponent(url.pathname.slice("/v1/models/".length));
      return json(200, { id, type: "model", display_name: id, created_at: "2026-10-01T00:00:00Z", max_input_tokens: options.maxInputTokens === undefined ? 1_000_000 : options.maxInputTokens, max_tokens: 128_000 });
    }
    if (method === "POST" && url.pathname === "/v1/messages/count_tokens") return json(200, { input_tokens: options.countTokens ?? 1000 });

    if (method === "POST" && url.pathname === "/v1/messages/batches") {
      const id = `msgbatch_synth${++next}`;
      batches.set(id, { requests: body!.requests, retrieved: 0 });
      return json(200, batchObject(id, "in_progress", url.origin, null));
    }
    const m = /^\/v1\/messages\/batches\/(msgbatch_\w+)(\/results|\/cancel)?$/.exec(url.pathname);
    if (m) {
      const batch = batches.get(m[1]);
      if (!batch) return json(404, { type: "error", error: { type: "not_found_error", message: "inconnu" } });
      if (m[2] === "/cancel") return json(200, batchObject(m[1], "canceling", url.origin, null));
      if (!m[2]) {
        batch.retrieved++;
        if (options.inProgressOnce && batch.retrieved === 1) return json(200, batchObject(m[1], "in_progress", url.origin, null));
        const results = await resultsOf(batch);
        const counts = { processing: 0, succeeded: 0, errored: 0, canceled: 0, expired: 0 };
        for (const r of results) counts[r.type]++;
        if (options.tamper?.kind === "compteur" && tamperLeft > 0) {
          tamperLeft--;
          counts.succeeded++;
        }
        return json(200, batchObject(m[1], "ended", url.origin, counts));
      }
      const results = await resultsOf(batch);
      let lines = batch.requests.map((r, i) => ({ custom_id: r.custom_id, result: toResult(results[i], r.params.model) }));
      if (tamperLeft > 0 && options.tamper && options.tamper.kind !== "compteur") {
        tamperLeft--;
        const kind = options.tamper.kind;
        if (kind === "vide") lines = [];
        if (kind === "tronque") lines = lines.slice(0, -1);
        if (kind === "doublon") lines = [...lines, lines[0]];
        if (kind === "inconnu") lines = [...lines.slice(0, -1), { ...lines[lines.length - 1], custom_id: "inconnu-synthetique" }];
        if (kind === "usage") lines = lines.map((l, i) => (i === 0 && l.result.type === "succeeded" ? { ...l, result: { ...l.result, message: { ...l.result.message, usage: { input_tokens: -5, output_tokens: 1.5 } } } } : l));
      }
      return new Response(lines.map((l) => JSON.stringify(l)).join("\n") + (lines.length ? "\n" : ""), { status: 200, headers: { "content-type": "application/binary" } });
    }
    return json(404, { type: "error", error: { type: "not_found_error", message: `${key} non simulé` } });
  };

  return { fetch: fetchFn as typeof fetch, calls };
}

function batchObject(id: string, status: string, origin: string, counts: Record<string, number> | null) {
  return {
    id,
    type: "message_batch",
    processing_status: status,
    request_counts: counts ?? { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
    created_at: "2026-11-12T00:00:00Z",
    expires_at: "2026-11-13T00:00:00Z",
    ended_at: status === "ended" ? "2026-11-12T00:30:00Z" : null,
    cancel_initiated_at: null,
    archived_at: null,
    results_url: status === "ended" ? `${origin}/v1/messages/batches/${id}/results` : null,
  };
}

function toResult(res: FakeResult, model: string): any {
  if (res.type === "errored") return { type: "errored", error: { type: "error", error: { type: res.errorType, message: "erreur synthétique" } } };
  if (res.type !== "succeeded") return { type: res.type };
  return {
    type: "succeeded",
    message: {
      id: "msg_synthetique",
      type: "message",
      role: "assistant",
      model,
      content: [{ type: "text", text: res.text }],
      stop_reason: res.stop_reason ?? "end_turn",
      stop_sequence: null,
      stop_details: res.stop_reason === "refusal" ? { type: "refusal", category: res.category ?? "cyber", explanation: null } : null,
      usage: { input_tokens: res.usage?.input_tokens ?? 1000, output_tokens: res.usage?.output_tokens ?? 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  };
}
