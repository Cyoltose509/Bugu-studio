import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "使用条款",
  description: "布谷工作室使用条款 — 了解使用本网站时您需遵守的规则与责任。",
};

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "布谷工作室";
const contactEmail = "admin@bugu.cn";
const lastUpdated = "2026-06-08";

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F5F9FC" }}>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* 头部 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/images/logo.png" alt={siteName} width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-lg" style={{ color: "#25547A" }}>{siteName}</span>
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#25547A" }}>使用条款</h1>
          <p className="text-sm" style={{ color: "#999" }}>最后更新：{lastUpdated}</p>
        </div>

        {/* 正文 */}
        <div className="space-y-8 text-sm leading-relaxed" style={{ color: "#555" }}>
          <Section title="1. 接受条款">
            <p>欢迎访问{siteName}（以下简称「本网站」）。通过访问或使用本网站，即表示您同意遵守本使用条款的全部规定。如果您不同意其中任何条款，请不要使用本网站。</p>
            <p>本网站为布谷工作室（游戏开发社团）的官方平台，旨在展示社团历史、成员作品，促进成员间的交流与合作。</p>
          </Section>

          <Section title="2. 服务说明">
            <p>本网站提供以下服务：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>浏览社团成员的游戏作品</li>
              <li>查看社团历史和成员信息</li>
              <li>注册账号并提交作品展示</li>
              <li>修改个人资料（头像、名称等）</li>
            </ul>
            <p className="mt-2">本网站为非商业性社团平台，所有服务免费提供，不涉及任何商业交易或收费项目。</p>
          </Section>

          <Section title="3. 用户注册与账号安全">
            <ul className="list-disc pl-5 space-y-1">
              <li>注册时您必须提供真实、准确的邮箱地址</li>
              <li>您有责任维护账号和密码的机密性，对账号下的所有活动负责</li>
              <li>一旦发现未经授权的账号使用，请立即通知我们</li>
              <li>一人一账号，禁止创建虚假账号或冒用他人身份</li>
              <li>本网站管理员有权在任何时候禁用、暂停或删除违反规定的账号</li>
            </ul>
          </Section>

          <Section title="4. 用户行为规范">
            <p>在使用本网站时，您同意不从事以下行为：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>发布任何违法、侵权、诽谤、淫秽、骚扰性或歧视性内容</li>
              <li>上传包含恶意软件、病毒或任何可能损害网站功能的代码或文件</li>
              <li>试图未经授权访问网站系统、其他用户账号或数据库</li>
              <li>使用自动化脚本、爬虫或其他方式对网站进行大规模数据抓取</li>
              <li>干扰或破坏网站的正常运行（包括 DDoS 攻击、压力测试等）</li>
              <li>冒充布谷工作室成员、管理员或其他身份</li>
              <li>发布商业广告、垃圾信息或未经许可的推广内容</li>
            </ul>
          </Section>

          <Section title="5. 知识产权">
            <h4 className="font-semibold mb-1" style={{ color: "#333" }}>您的作品：</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>您上传和发布的游戏作品及其截图、描述等内容的知识产权仍归您所有</li>
              <li>您授予本网站在平台上展示该内容的非独占、免版税许可</li>
              <li>您可以随时要求下架您的作品</li>
            </ul>
            <h4 className="font-semibold mb-1 mt-3" style={{ color: "#333" }}>网站内容：</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>布谷工作室的名称、logo、网站界面设计、源代码归布谷工作室所有</li>
              <li>未经明确授权，不得以任何形式复制、修改或分发网站的非用户生成内容</li>
            </ul>
          </Section>

          <Section title="6. 管理员权利">
            <p>为维护平台秩序和安全，管理员保留以下权利：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>审核、编辑或删除任何违反本条款的用户提交内容</li>
              <li>对违规用户发出警告、临时或永久禁用账号</li>
              <li>在不事先通知的情况下修改或终止部分服务功能</li>
            </ul>
            <p className="mt-2">管理员的决定为最终决定，但我们欢迎您就任何决定提出申诉。</p>
          </Section>

          <Section title="7. 免责声明">
            <ul className="list-disc pl-5 space-y-1">
              <li>本网站按「现状」提供，不提供任何明示或暗示的保证</li>
              <li>我们不保证网站服务不中断、及时、安全或没有错误</li>
              <li>对于因使用或不能使用本网站而产生的任何直接或间接损失，我们不承担责任</li>
              <li>对于用户之间的纠纷，我们不承担调解或法律责任</li>
              <li>对于因不可抗力（如自然灾害、网络攻击、第三方服务中断）导致的服务中断，我们不承担责任</li>
            </ul>
          </Section>

          <Section title="8. 第三方链接与服务">
            <p>本网站可能包含指向第三方网站（如 Bilibili、GitHub）的链接。我们对这些第三方内容的准确性、合法性不承担责任。访问第三方网站的风险由您自行承担。</p>
          </Section>

          <Section title="9. 条款修改">
            <p>我们保留随时修改本使用条款的权利。修改后的条款在网站上发布后立即生效。重大变更将通过网站公告或邮件通知注册用户。您继续使用本网站即表示接受修改后的条款。</p>
          </Section>

          <Section title="10. 准据法与争议解决">
            <p>本使用条款受中华人民共和国法律管辖。因使用本网站产生的任何争议，双方应首先友好协商解决；协商不成的，提交有管辖权的人民法院处理。</p>
          </Section>

          <Section title="11. 联系我们">
            <p>如果您对本使用条款有任何疑问或建议，请通过以下方式联系我们：</p>
            <p className="mt-2">
              邮箱：<a href={`mailto:${contactEmail}`} className="font-medium" style={{ color: "#3388BB" }}>{contactEmail}</a>
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 text-center border-t" style={{ borderColor: "#D0DEE8" }}>
          <Link href="/" className="text-sm" style={{ color: "#3388BB" }}>&larr; 返回首页</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold mb-3" style={{ color: "#333" }}>{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
