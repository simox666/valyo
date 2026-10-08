import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Home() {
  const t = useTranslations("home");

  return (
    <main className="min-h-screen bg-paper">
      <div className="w-full max-w-md mx-auto px-6 py-6 space-y-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-[13px] font-extrabold tracking-[0.22em] text-ink">
            VALYO
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Hero */}
        <div className="space-y-8 text-center">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{t("eyebrow")}</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-ink">{t("title")}</h1>
            <p className="text-neutral-600">{t("subtitle")}</p>
          </div>

          <div className="space-y-3">
            <Link href="/scan?mode=capture" className="block w-full rounded-2xl bg-accent text-white py-4 font-semibold">
              {t("ctaPrimary")}
            </Link>
            <Link
              href="/scan?mode=import"
              className="block w-full rounded-2xl border border-line text-ink py-[15px] font-semibold"
            >
              {t("ctaSecondary")}
            </Link>
          </div>

          <p className="text-xs text-neutral-400">{t("mention")}</p>

          <div className="rounded-2xl border border-line bg-white p-[18px] text-left space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-accent">{t("example.label")}</p>
            <p className="font-semibold text-ink text-sm">{t("example.object")}</p>
            <p className="text-2xl font-extrabold tracking-tight text-ink">{t("example.price")}</p>
            <p className="text-xs text-neutral-500">{t("example.basis")}</p>
            <p className="text-[11px] text-neutral-400">{t("example.limit")}</p>
          </div>
        </div>

        {/* Three steps */}
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium text-neutral-600">{t("steps.eyebrow")}</p>
          <div className="grid grid-cols-3 gap-3 text-left">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-ink">{t("steps.1.title")}</p>
              <p className="text-xs text-neutral-500">{t("steps.1.body")}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-ink">{t("steps.2.title")}</p>
              <p className="text-xs text-neutral-500">{t("steps.2.body")}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-ink">{t("steps.3.title")}</p>
              <p className="text-xs text-neutral-500">{t("steps.3.body")}</p>
            </div>
          </div>
        </div>

        {/* Room card */}
        <Link href="/room" className="block rounded-2xl bg-accent-soft p-6 space-y-3">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{t("roomCard.title")}</h2>
          <p className="text-sm text-neutral-700">{t("roomCard.body")}</p>
          <p className="text-sm font-bold text-accent">{t("roomCard.cta")}</p>
        </Link>

        {/* Game card */}
        <Link href="/game" className="block rounded-2xl bg-chip p-6 space-y-3">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{t("gameCard.title")}</h2>
          <p className="text-sm text-neutral-700">{t("gameCard.body")}</p>
          <p className="text-sm font-bold text-ink">{t("gameCard.cta")}</p>
        </Link>

        {/* Trust block */}
        <div className="space-y-2 text-center border-t border-line pt-8">
          <p className="font-bold text-ink">{t("trust.title")}</p>
          <p className="text-sm text-neutral-600">{t("trust.body")}</p>
          <Link href="/privacy" className="inline-block text-xs text-neutral-500 underline pt-1">
            {t("trust.link")}
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1 pb-8">
          <p className="text-[13px] font-extrabold tracking-[0.22em] text-ink">VALYO</p>
          <p className="text-xs text-neutral-400">{t("footer.tagline")}</p>
          <Link href="/privacy" className="inline-block text-xs text-neutral-400 underline pt-1">
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </main>
  );
}
