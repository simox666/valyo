import type { EditorialConfig } from "../config.ts";
import type { Query } from "../types.ts";
import { createClaudeProvider } from "./claude.ts";
import { createTestProvider } from "./test.ts";
import type { EditorialProvider } from "./types.ts";

/**
 * Fournisseur correspondant à la configuration. Aucun repli : sans clé ou sans
 * modèle, le fournisseur Claude est indisponible (null + motif), jamais remplacé
 * par le fournisseur de test. La valeur de la clé n'est jamais journalisée.
 */
export function providerFromConfig(
  config: EditorialConfig,
  q: Query,
  env: { anthropicApiKey?: string; fetch?: typeof fetch },
): { provider: EditorialProvider | null; reason?: string } {
  if (config.provider === "test") return { provider: createTestProvider(q) };
  if (config.provider === "claude") {
    if (!env.anthropicApiKey) return { provider: null, reason: "clé API Claude absente (ANTHROPIC_API_KEY)" };
    if (!config.model) return { provider: null, reason: "modèle Claude non configuré" };
    return { provider: createClaudeProvider({ apiKey: env.anthropicApiKey, model: config.model, fetch: env.fetch }) };
  }
  return { provider: null, reason: "aucun fournisseur choisi" };
}
