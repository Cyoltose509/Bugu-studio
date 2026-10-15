import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "page.terms.title"), description: t(lang, "page.terms.description") };
}

const contactEmail = "connect@bugoostudio.com";
const lastUpdated = "2026-06-11";

export default async function TermsPage() {
  const lang = await getLang();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || t(lang, "brand.name");

  return (
    <div className="min-h-screen bg-brand-surface-page">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* 头部 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/images/logo.png" alt={siteName} width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-lg text-brand-navy">{siteName}</span>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-brand-navy">{t(lang, "page.terms.title")}</h1>
          <p className="text-sm text-brand-text-muted">{t(lang, "terms.lastUpdated", { date: lastUpdated })}</p>
        </div>

        {/* 正文 */}
        <div className="space-y-8 text-sm leading-relaxed text-brand-text-body">
          <Section title={t(lang, "terms.s1.title")}>
            <p>{t(lang, "terms.s1.p1", { site: siteName })}</p>
            <p>{t(lang, "terms.s1.p2")}</p>
          </Section>

          <Section title={t(lang, "terms.s2.title")}>
            <p>{t(lang, "terms.s2.lead")}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "terms.s2.li1")}</li>
              <li>{t(lang, "terms.s2.li2")}</li>
              <li>{t(lang, "terms.s2.li3")}</li>
              <li>{t(lang, "terms.s2.li4")}</li>
            </ul>
            <p className="mt-2">{t(lang, "terms.s2.note")}</p>
          </Section>

          <Section title={t(lang, "terms.s3.title")}>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "terms.s3.li1")}</li>
              <li>{t(lang, "terms.s3.li2")}</li>
              <li>{t(lang, "terms.s3.li3")}</li>
              <li>{t(lang, "terms.s3.li4")}</li>
              <li>{t(lang, "terms.s3.li5")}</li>
            </ul>
          </Section>

          <Section title={t(lang, "terms.s4.title")}>
            <p>{t(lang, "terms.s4.lead")}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "terms.s4.li1")}</li>
              <li>{t(lang, "terms.s4.li2")}</li>
              <li>{t(lang, "terms.s4.li3")}</li>
              <li>{t(lang, "terms.s4.li4")}</li>
              <li>{t(lang, "terms.s4.li5")}</li>
              <li>{t(lang, "terms.s4.li6")}</li>
              <li>{t(lang, "terms.s4.li7")}</li>
            </ul>
          </Section>

          <Section title={t(lang, "terms.s5.title")}>
            <h4 className="font-semibold mb-1 text-brand-text-heading">{t(lang, "terms.s5.yourWorksTitle")}</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "terms.s5.w1")}</li>
              <li>{t(lang, "terms.s5.w2")}</li>
              <li>{t(lang, "terms.s5.w3")}</li>
            </ul>
            <h4 className="font-semibold mb-1 mt-3 text-brand-text-heading">{t(lang, "terms.s5.siteContentTitle")}</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "terms.s5.c1")}</li>
              <li>{t(lang, "terms.s5.c2")}</li>
            </ul>
          </Section>

          <Section title={t(lang, "terms.s6.title")}>
            <p>{t(lang, "terms.s6.lead")}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "terms.s6.li1")}</li>
              <li>{t(lang, "terms.s6.li2")}</li>
              <li>{t(lang, "terms.s6.li3")}</li>
            </ul>
            <p className="mt-2">{t(lang, "terms.s6.note")}</p>
          </Section>

          <Section title={t(lang, "terms.s7.title")}>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "terms.s7.li1")}</li>
              <li>{t(lang, "terms.s7.li2")}</li>
              <li>{t(lang, "terms.s7.li3")}</li>
              <li>{t(lang, "terms.s7.li4")}</li>
              <li>{t(lang, "terms.s7.li5")}</li>
            </ul>
          </Section>

          <Section title={t(lang, "terms.s8.title")}>
            <p>{t(lang, "terms.s8.p")}</p>
          </Section>

          <Section title={t(lang, "terms.s9.title")}>
            <p>{t(lang, "terms.s9.p")}</p>
          </Section>

          <Section title={t(lang, "terms.s10.title")}>
            <p>{t(lang, "terms.s10.p")}</p>
          </Section>

          <Section title={t(lang, "terms.s11.title")}>
            <p>{t(lang, "terms.s11.p1")}</p>
            <p className="mt-2">
              {t(lang, "terms.s11.emailLabel")}<a href={`mailto:${contactEmail}`} className="font-medium text-brand-blue">{contactEmail}</a>
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 text-center border-t border-brand-border-subtle">
          <Link href="/" className="text-sm text-brand-blue">&larr; {t(lang, "common.backToHome")}</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold mb-3 text-brand-text-heading">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
