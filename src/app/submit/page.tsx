import { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultTags } from "@/lib/db/tags";
import SubmitForm from "@/components/forms/SubmitForm";
import LogoLoading from "@/components/ui/LogoLoading";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "page.submit.title"), description: t(lang, "page.submit.description") };
}

export const dynamic = "force-dynamic";

/* ── 同步 Shell ── */

export default async function SubmitPage() {
  const lang = await getLang();
  return (
    <Suspense fallback={<LogoLoading text={t(lang, "submit.loading")} compact />}>
      <SubmitContent />
    </Suspense>
  );
}

/* ── 异步数据组件 ── */

async function SubmitContent() {
  await ensureDefaultTags();
  const lang = await getLang();
  const tags = await prisma.tag.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, group: true, color: true, sortOrder: true },
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-navy">
          {t(lang, "page.submit.title")}
        </h1>
        <p className="mt-2 text-brand-text-secondary">
          {t(lang, "submit.pageDesc")}
        </p>
      </div>

      <div
        className="bg-card rounded-xl border shadow-sm p-6 border-brand-border-subtle"
      >
        <SubmitForm tags={tags} />
      </div>
    </div>
  );
}
