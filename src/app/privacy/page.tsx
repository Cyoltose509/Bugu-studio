import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "隐私政策",
  description: "布谷工作室隐私政策 — 了解我们如何收集、使用和保护您的个人信息。",
};

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "布谷工作室";
const contactEmail = "cyoltose@gmail.com";

const lastUpdated = "2026-06-08";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F5F9FC]">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* 头部 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/images/logo.png" alt={siteName} width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-lg text-brand-navy">{siteName}</span>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-brand-navy">隐私政策</h1>
          <p className="text-sm text-brand-text-muted">最后更新：{lastUpdated}</p>
        </div>

        {/* 正文 */}
        <div className="space-y-8 text-sm leading-relaxed text-brand-text-body">
          <Section title="1. 概述">
            <p>欢迎使用{siteName}（以下简称「本网站」）。我们深知个人信息对您的重要性，将按照法律法规要求，采取相应安全保护措施，尽力保护您的个人信息安全。</p>
            <p>本隐私政策阐述了当您访问本网站或使用我们的服务时，我们如何收集、使用、存储和保护您的信息。请仔细阅读本政策，以了解我们的做法。</p>
          </Section>

          <Section title="2. 我们收集的信息">
            <h4 className="font-semibold mb-1 text-brand-text-heading">您主动提供的信息：</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>邮箱地址</strong> — 注册账号、接收验证码和通知时使用</li>
              <li><strong>用户名称</strong> — 您在网站上的显示名称</li>
              <li><strong>头像图片</strong> — 您上传的个人头像，用于个人资料展示</li>
              <li><strong>作品信息</strong> — 您提交的游戏作品名称、描述、截图等</li>
            </ul>
            <h4 className="font-semibold mb-1 mt-3 text-brand-text-heading">我们自动收集的信息：</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>登录凭证 (Cookie)</strong> — 仅用于维持您的登录会话，不用于追踪或广告目的</li>
              <li><strong>访问日志</strong> — 包括 IP 地址、浏览器类型、访问时间等基础网络信息，仅用于安全防护和故障排查</li>
            </ul>
            <p className="text-xs mt-2 text-brand-text-muted">
              * 我们<strong>不会</strong>收集您的手机号、身份证号、精确地理位置、设备指纹等敏感信息。
            </p>
          </Section>

          <Section title="3. 信息的使用目的">
            <p>我们收集的信息仅用于以下目的：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>验证您的身份，确保账号安全</li>
              <li>发送账户相关通知（如邮箱验证码）</li>
              <li>在网站上公开展示您提交的作品信息和署名</li>
              <li>维护和改进网站服务</li>
              <li>防范安全风险和欺诈行为</li>
            </ul>
            <p className="mt-2">我们<strong>不会</strong>将您的个人信息用于任何自动化决策、用户画像分析，或出售、出租给任何第三方。</p>
          </Section>

          <Section title="4. 第三方服务">
            <p>为提供网站服务，我们使用了以下第三方服务，它们可能会接触部分数据：</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EEF4FA]">
                    <th className="text-left p-2 border border-brand-border-subtle">服务</th>
                    <th className="text-left p-2 border border-brand-border-subtle">用途</th>
                    <th className="text-left p-2 border border-brand-border-subtle">涉及数据</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-brand-border-subtle">Supabase</td>
                    <td className="p-2 border border-brand-border-subtle">数据库与身份认证</td>
                    <td className="p-2 border border-brand-border-subtle">用户信息、作品数据</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-brand-border-subtle">Cloudflare R2</td>
                    <td className="p-2 border border-brand-border-subtle">文件存储（图片上传）</td>
                    <td className="p-2 border border-brand-border-subtle">头像、作品截图</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-brand-border-subtle">Resend</td>
                    <td className="p-2 border border-brand-border-subtle">发送验证邮件</td>
                    <td className="p-2 border border-brand-border-subtle">邮箱地址</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-brand-border-subtle">Vercel</td>
                    <td className="p-2 border border-brand-border-subtle">网站托管与部署</td>
                    <td className="p-2 border border-brand-border-subtle">访问日志</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="5. 数据存储与安全">
            <ul className="list-disc pl-5 space-y-1">
              <li>用户数据存储在 Supabase 托管的 PostgreSQL 数据库（亚太地区），受数据库访问控制保护</li>
              <li>上传的图片文件存储在 Cloudflare R2，通过自定义域名 CDN 分发</li>
              <li>密码使用 scrypt 算法加盐哈希存储，<strong>不保存明文密码</strong></li>
              <li>网站通过 HTTPS 加密传输所有数据</li>
              <li>我们采取合理的技术和管理措施保护您的信息，但请注意互联网不存在绝对的安全</li>
            </ul>
          </Section>

          <Section title="6. 您的权利">
            <p>根据适用法律，您享有以下权利：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>访问与更正</strong> — 登录后可在个人资料页查看和编辑您的信息</li>
              <li><strong>删除</strong> — 您可以要求删除您的账号及相关数据（请通过下方联系方式提出）</li>
              <li><strong>撤回同意</strong> — 您可以停止使用本网站，已收集的信息将按保留政策处理</li>
              <li><strong>数据导出</strong> — 您有权要求获取您的个人数据副本</li>
            </ul>
          </Section>

          <Section title="7. Cookie 政策">
            <p>本网站使用必要的 Cookie 维持您的登录状态（JWT Token）。这些 Cookie 是网站正常运行所必需的，不会用于追踪、广告或分析目的。</p>
            <p>我们<strong>不使用</strong>第三方追踪 Cookie、社交媒体 Cookie 或广告定向 Cookie。</p>
          </Section>

          <Section title="8. 儿童隐私">
            <p>本网站并非面向 14 周岁以下的儿童。我们不会在知情的情况下收集儿童的个人信息。如果您是监护人且认为您的孩子向我们提供了个人信息，请与我们联系。</p>
          </Section>

          <Section title="9. 政策更新">
            <p>我们可能不定期更新本隐私政策。重大变更时，我们会通过在网站上发布通知或发送邮件的方式告知您。建议您定期查看本页面以了解最新信息。</p>
          </Section>

          <Section title="10. 联系我们">
            <p>如果您对本隐私政策有任何疑问、意见或投诉，请通过以下方式联系我们：</p>
            <p className="mt-2">
              邮箱：<a href={`mailto:${contactEmail}`} className="font-medium text-brand-blue">{contactEmail}</a>
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 text-center border-t border-brand-border-subtle">
          <Link href="/" className="text-sm text-brand-blue">&larr; 返回首页</Link>
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
