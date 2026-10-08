import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createMagicLinkToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_LOCALES = ["fr", "en", "nl", "es"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// A path only, never an absolute URL — the verify route redirects here
// after login, and accepting an attacker-supplied absolute URL there would
// be an open redirect.
function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function POST(req: NextRequest) {
  // Reuses the scan quota's limiter under a distinct key prefix — not about
  // sharing the budget, just reusing the same in-memory per-IP/global
  // mechanism (and its documented single-instance limitation) rather than
  // building a second one for a much lower-value abuse target (email spam,
  // not a paid API call).
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`auth:${ip}`);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { email, locale, redirect } = body as { email?: unknown; locale?: unknown; redirect?: unknown };

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const safeLocale: SupportedLocale = SUPPORTED_LOCALES.includes(locale as SupportedLocale)
    ? (locale as SupportedLocale)
    : "fr";
  const redirectPath = safeRedirectPath(redirect);

  const token = createMagicLinkToken(email.trim().toLowerCase());
  const verifyUrl = new URL("/api/auth/verify", req.nextUrl.origin);
  verifyUrl.searchParams.set("token", token);
  verifyUrl.searchParams.set("redirect", redirectPath);

  const t = await getTranslations({ locale: safeLocale, namespace: "auth" });

  try {
    await sendMagicLinkEmail(
      email.trim(),
      t("magicLinkSubject"),
      t("magicLinkBody", { link: verifyUrl.toString() }),
    );
  } catch (err) {
    console.error("magic link email failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
