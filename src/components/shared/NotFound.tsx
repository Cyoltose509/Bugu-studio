import Link from "next/link";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";

export default async function NotFoundPage() {
  const lang = await getLang();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4" role="alert">
      <h2 className="text-6xl font-bold text-brand-text-muted mb-4">404</h2>
      <p className="text-xl font-semibold text-brand-text-heading mb-2">{t(lang, "notFound.title")}</p>
      <p className="text-brand-text-secondary mb-8 text-center max-w-md">
        {t(lang, "notFound.desc")}
      </p>
      <Link
        href="/"
        className="btn-primary px-6 py-2.5 rounded-lg text-sm font-medium"
      >
        {t(lang, "common.backToHome")}
      </Link>
    </div>
  );
}
