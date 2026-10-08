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
          <h1 className="text-4xl font-semibold text-ink">{t("title")}</h1>
          <p className="text-neutral-600">{t("subtitle")}</p>
        </div>

        <div className="space-y-3">
          <Link href="/scan" className="block w-full rounded-full bg-ink text-white py-4 font-medium">
            {t("takePhoto")}
          </Link>
          <Link
            href="/scan"
            className="block w-full rounded-full border border-neutral-300 text-ink py-4 font-medium"
          >
            {t("importPhoto")}
          </Link>
        </div>

        <p className="text-sm text-neutral-500">{t("anyObject")}</p>

        <p className="text-xs text-neutral-400">{t("noInvention")}</p>

        <Link
          href="/room"
          className="block w-full rounded-full border border-neutral-300 text-ink py-4 font-medium"
        >
          {t("scanRoom")}
        </Link>

        <Link
          href="/game"
          className="block w-full rounded-full bg-neutral-100 text-ink py-4 font-medium"
        >
          {t("playGame")}
        </Link>
      </div>
    </main>
  );
}
