import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 bg-paper">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t("title")}</h1>
          <p className="text-sm text-neutral-600">{t("intro")}</p>
        </div>

        <div className="space-y-6 text-sm">
          <section className="space-y-1">
            <h2 className="font-medium text-ink">{t("dataTitle")}</h2>
            <p className="text-neutral-600">{t("dataBody")}</p>
          </section>

          <section className="space-y-1">
            <h2 className="font-medium text-ink">{t("logsTitle")}</h2>
            <p className="text-neutral-600">{t("logsBody")}</p>
          </section>

          <section className="space-y-1">
            <h2 className="font-medium text-ink">{t("rateLimitTitle")}</h2>
            <p className="text-neutral-600">{t("rateLimitBody")}</p>
          </section>

          <section className="space-y-1">
            <h2 className="font-medium text-ink">{t("disclaimerTitle")}</h2>
            <p className="text-neutral-600">{t("disclaimerBody")}</p>
          </section>

          <section className="space-y-1">
            <h2 className="font-medium text-ink">{t("contactTitle")}</h2>
            <p className="text-neutral-600">
              {t.rich("contactBody", {
                email: (chunks) => (
                  <a href={`mailto:${chunks}`} className="text-blue-600 underline">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </section>
        </div>

        <Link href="/" className="block text-sm text-neutral-500 underline">
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
