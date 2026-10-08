"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AuthGate, { useSession } from "@/components/AuthGate";

function HubContent() {
  const t = useTranslations("game");
  const { user } = useSession();

  return (
    <div className="w-full max-w-md text-center space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("title")}</h1>
      <p className="text-neutral-600">{t("heroIntro")}</p>

      {user && (
        <div className="rounded-2xl border border-line p-4 space-y-1">
          <p className="text-xs text-neutral-500">{t("yourPoints")}</p>
          <p className="text-2xl font-extrabold tracking-tight text-ink">{t("pointsValue", { points: user.totalPoints })}</p>
          {user.badge && <p className="text-sm text-neutral-600">{t(`badge.${user.badge}`)}</p>}
          {user.nextBadge && (
            <p className="text-xs text-neutral-400">
              {t("nextBadgeHint", {
                points: user.nextBadge.threshold - user.totalPoints,
                badge: t(`badge.${user.nextBadge.key}`),
              })}
            </p>
          )}
        </div>
      )}

      <AuthGate>
        <Link href="/game/new" className="block w-full rounded-2xl bg-accent text-white py-4 font-semibold">
          {t("newChallenge")}
        </Link>
      </AuthGate>

      <Link href="/" className="block text-sm text-neutral-500 underline">
        {t("backHome")}
      </Link>
    </div>
  );
}

export default function GameHubPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      <HubContent />
    </main>
  );
}
