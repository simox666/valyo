import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Home() {
  const t = useTranslations("home");

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-3">
          <p className="text-[13px] font-extrabold tracking-[0.22em] text-ink">VALYO</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">{t("title")}</h1>
          <p className="text-neutral-600">{t("subtitle")}</p>
        </div>

        <div className="space-y-3">
          <Link href="/scan?mode=capture" className="block w-full rounded-2xl bg-accent text-white py-4 font-semibold">
            {t("takePhoto")}
          </Link>
          <Link
            href="/scan?mode=import"
            className="block w-full rounded-2xl border border-line text-ink py-[15px] font-semibold"
          >
            {t("importPhoto")}
          </Link>
        </div>

        <div className="rounded-2xl border border-line bg-white p-[18px] text-left space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-accent">{t("example.label")}</p>
          <p className="font-semibold text-ink text-sm">{t("example.object")}</p>
          <p className="text-2xl font-extrabold tracking-tight text-ink">{t("example.price")}</p>
          <p className="text-xs text-neutral-500">{t("example.basis")}</p>
          <p className="text-[11px] text-neutral-400">{t("example.limit")}</p>
        </div>

        <p className="text-sm text-neutral-500">{t("anyObject")}</p>

        <p className="text-xs text-neutral-400">{t("noInvention")}</p>

        <Link
          href="/room"
          className="block w-full rounded-2xl border border-line text-ink py-[15px] font-semibold"
        >
          {t("scanRoom")}
        </Link>

        <Link
          href="/game"
          className="block w-full rounded-2xl bg-chip text-ink py-[15px] font-semibold"
        >
          {t("playGame")}
        </Link>

        <Link href="/privacy" className="block text-xs text-neutral-400 underline">
          {t("privacyLink")}
        </Link>
      </div>
    </main>
  );
}
