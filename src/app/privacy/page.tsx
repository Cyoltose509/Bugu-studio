import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, "page.privacy.title"), description: t(lang, "page.privacy.description") };
}

const contactEmail = "cyoltose@gmail.com";

const lastUpdated = "2026-06-08";

export default async function PrivacyPage() {
  const lang = await getLang();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || t(lang, "brand.name");

  return (
    <div className="min-h-screen bg-[#F5F9FC]">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* 头部 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/images/logo.png" alt={siteName} width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-lg text-brand-navy">{siteName}</span>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-brand-navy">{t(lang, "page.privacy.title")}</h1>
          <p className="text-sm text-brand-text-muted">{t(lang, "privacy.lastUpdated", { date: lastUpdated })}</p>
        </div>

        {/* 正文 */}
        <div className="space-y-8 text-sm leading-relaxed text-brand-text-body">
          <Section title={t(lang, "privacy.s1.title")}>
            <p>{t(lang, "privacy.s1.p1", { site: siteName })}</p>
            <p>{t(lang, "privacy.s1.p2")}</p>
          </Section>

          <Section title={t(lang, "privacy.s2.title")}>
            <h4 className="font-semibold mb-1 text-brand-text-heading">{t(lang, "privacy.s2.providedTitle")}</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>{t(lang, "privacy.s2.emailBold")}</strong>{t(lang, "privacy.s2.emailRest")}</li>
              <li><strong>{t(lang, "privacy.s2.usernameBold")}</strong>{t(lang, "privacy.s2.usernameRest")}</li>
              <li><strong>{t(lang, "privacy.s2.avatarBold")}</strong>{t(lang, "privacy.s2.avatarRest")}</li>
              <li><strong>{t(lang, "privacy.s2.worksBold")}</strong>{t(lang, "privacy.s2.worksRest")}</li>
            </ul>
            <h4 className="font-semibold mb-1 mt-3 text-brand-text-heading">{t(lang, "privacy.s2.autoTitle")}</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>{t(lang, "privacy.s2.cookieBold")}</strong>{t(lang, "privacy.s2.cookieRest")}</li>
              <li><strong>{t(lang, "privacy.s2.logBold")}</strong>{t(lang, "privacy.s2.logRest")}</li>
            </ul>
            <p className="text-xs mt-2 text-brand-text-muted">
              * {t(lang, "privacy.s2.sensitivePre")}<strong>{t(lang, "privacy.s2.sensitiveBold")}</strong>{t(lang, "privacy.s2.sensitivePost")}
            </p>
          </Section>

          <Section title={t(lang, "privacy.s3.title")}>
            <p>{t(lang, "privacy.s3.lead")}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "privacy.s3.li1")}</li>
              <li>{t(lang, "privacy.s3.li2")}</li>
              <li>{t(lang, "privacy.s3.li3")}</li>
              <li>{t(lang, "privacy.s3.li4")}</li>
              <li>{t(lang, "privacy.s3.li5")}</li>
            </ul>
            <p className="mt-2">{t(lang, "privacy.s3.noAutoPre")}<strong>{t(lang, "privacy.s3.noAutoBold")}</strong>{t(lang, "privacy.s3.noAutoPost")}</p>
          </Section>

          <Section title={t(lang, "privacy.s4.title")}>
            <p>{t(lang, "privacy.s4.lead")}</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EEF4FA]">
                    <th className="text-left p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.thService")}</th>
                    <th className="text-left p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.thPurpose")}</th>
                    <th className="text-left p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.thData")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-brand-border-subtle">Supabase</td>
                    <td className="p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.r1Purpose")}</td>
                    <td className="p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.r1Data")}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-brand-border-subtle">Cloudflare R2</td>
                    <td className="p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.r2Purpose")}</td>
                    <td className="p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.r2Data")}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-brand-border-subtle">Resend</td>
                    <td className="p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.r3Purpose")}</td>
                    <td className="p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.r3Data")}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-brand-border-subtle">Vercel</td>
                    <td className="p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.r4Purpose")}</td>
                    <td className="p-2 border border-brand-border-subtle">{t(lang, "privacy.s4.r4Data")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={t(lang, "privacy.s5.title")}>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t(lang, "privacy.s5.li1")}</li>
              <li>{t(lang, "privacy.s5.li2")}</li>
              <li>{t(lang, "privacy.s5.li3Pre")}<strong>{t(lang, "privacy.s5.li3Bold")}</strong></li>
              <li>{t(lang, "privacy.s5.li4")}</li>
              <li>{t(lang, "privacy.s5.li5")}</li>
            </ul>
          </Section>

          <Section title={t(lang, "privacy.s6.title")}>
            <p>{t(lang, "privacy.s6.lead")}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>{t(lang, "privacy.s6.accessBold")}</strong>{t(lang, "privacy.s6.accessRest")}</li>
              <li><strong>{t(lang, "privacy.s6.deleteBold")}</strong>{t(lang, "privacy.s6.deleteRest")}</li>
              <li><strong>{t(lang, "privacy.s6.withdrawBold")}</strong>{t(lang, "privacy.s6.withdrawRest")}</li>
              <li><strong>{t(lang, "privacy.s6.exportBold")}</strong>{t(lang, "privacy.s6.exportRest")}</li>
            </ul>
          </Section>

          <Section title={t(lang, "privacy.s7.title")}>
            <p>{t(lang, "privacy.s7.p1")}</p>
            <p>{t(lang, "privacy.s7.noTrackPre")}<strong>{t(lang, "privacy.s7.noTrackBold")}</strong>{t(lang, "privacy.s7.noTrackPost")}</p>
          </Section>

          <Section title={t(lang, "privacy.s8.title")}>
            <p>{t(lang, "privacy.s8.p")}</p>
          </Section>

          <Section title={t(lang, "privacy.s9.title")}>
            <p>{t(lang, "privacy.s9.p")}</p>
          </Section>

          <Section title={t(lang, "privacy.s10.title")}>
            <p>{t(lang, "privacy.s10.p1")}</p>
            <p className="mt-2">
              {t(lang, "privacy.s10.emailLabel")}<a href={`mailto:${contactEmail}`} className="font-medium text-brand-blue">{contactEmail}</a>
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

/** 统一的段落包装组件 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold mb-3 text-brand-text-heading">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
