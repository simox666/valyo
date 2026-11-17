import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Les requêtes qui modifient des données doivent venir du site lui-même :
 * le cookie SameSite=Lax bloque déjà l'essentiel, ce contrôle d'origine ferme le reste.
 *
 * Origine de confiance : APP_URL (obligatoire en production). Aucun en-tête de
 * proxy (x-forwarded-host…) n'est pris en compte. En développement sans
 * APP_URL, l'origine doit correspondre à l'en-tête Host.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const appUrl = process.env.APP_URL;
    if (appUrl) return new URL(origin).origin === new URL(appUrl).origin;
    if (process.env.NODE_ENV === "production") {
      console.error("APP_URL n'est pas configurée : toutes les écritures sont refusées.");
      return false;
    }
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

type Guard = { user: CurrentUser; response?: undefined } | { user?: undefined; response: NextResponse };

const SUSPENDED = "Votre compte est suspendu : vous ne pouvez pas contribuer.";

/**
 * Garde commune des écritures (anomalie A001) : origine, session et compte actif.
 * `allowOnboarding` laisse passer un compte qui n'a pas terminé son inscription
 * (uniquement pour la terminer) ; un compte suspendu est refusé dans tous les cas.
 */
export async function requireActiveUser(request: Request, { allowOnboarding = false } = {}): Promise<Guard> {
  if (!sameOrigin(request)) return { response: fail("Requête refusée.", 403) };
  const user = await getCurrentUser();
  if (!user) return { response: fail("Connectez-vous pour continuer.", 401) };
  if (user.status !== "active") return { response: fail(SUSPENDED, 403) };
  if (!user.onboarded && !allowOnboarding) {
    return { response: fail("Terminez votre inscription pour continuer.", 403, { onboarding: true }) };
  }
  return { user };
}

/** Administrateur actif. Les autres reçoivent 404 : l'existence de l'interface n'est pas révélée. */
export async function requireAdmin(request: Request): Promise<Guard> {
  if (!sameOrigin(request)) return { response: fail("Requête refusée.", 403) };
  const guard = await requireActiveUser(request);
  if (guard.response || !guard.user.isAdmin) return { response: fail("Introuvable.", 404) };
  return guard;
}

/** Membre connecté, inscription terminée, compte actif : condition de toute contribution. */
export function requireContributor(request: Request): Promise<Guard> {
  return requireActiveUser(request);
}

export { readBodyCapped, readJson } from "./http-body.ts";
