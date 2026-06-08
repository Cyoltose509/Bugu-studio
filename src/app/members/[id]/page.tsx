/**
 * 成员详情页
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import MemberContactInfo from "./MemberContactInfo";

// ISR: 成员信息变化少，5 分钟缓存
export const revalidate = 300;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const member = await prisma.clubMember.findUnique({
    where: { id },
    select: { displayName: true, bio: true },
  });
  if (!member) return { title: "成员不存在" };
  return {
    title: member.displayName,
    description: member.bio?.slice(0, 160) || `${member.displayName} 的成员页面`,
  };
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params;

  const member = await prisma.clubMember.findUnique({
    where: { id },
    include: {
      user: { select: { role: true, image: true, bio: true } },
      socialLinks: { orderBy: { sortOrder: "asc" } },
      projectMembers: {
        orderBy: { sortOrder: "asc" },
        include: {
          project: {
            select: {
              id: true,
              slug: true,
              title: true,
              type: true,
              coverImage: true,
              developYear: true,
            },
          },
        },
      },
    },
  });

  if (!member) notFound();

  const LINK_ICONS: Record<string, string> = {
    "GitHub": "💻", "B站": "▶️", "个人网站": "🌐", "知乎": "📝",
    "小红书": "📕", "微博": "📢", "抖音": "🎵", "CSDN": "📋",
    "掘金": "💎", "Steam": "🎮", "itch.io": "🕹️",
  };

  const links = (member.socialLinks ?? []).map((l) => ({
    label: l.label,
    url: l.url,
    icon: LINK_ICONS[l.label] || "🔗",
  }));

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      {/* 面包屑 */}
      <nav className="text-sm mb-8" style={{ color: "#999" }}>
        <Link href="/" className="hover:underline" style={{ color: "#777" }}>首页</Link>
        <span className="mx-2">/</span>
        <Link href="/members" className="hover:underline" style={{ color: "#777" }}>成员列表</Link>
        <span className="mx-2">/</span>
        <span style={{ color: "#555" }}>{member.displayName}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 左侧主区域 */}
        <div className="lg:col-span-2">
          {/* 顶部信息卡片 */}
          <div className="flex flex-col sm:flex-row items-start gap-6 mb-10 p-6 rounded-xl border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
            {/* 头像 */}
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shrink-0 overflow-hidden"
              style={{ background: "linear-gradient(135deg, #E38043, #F09055)" }}>
              {(member.user?.image || member.avatar) ? (
                <img src={(member.user?.image || member.avatar)!} alt={member.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                member.displayName[0]
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>{member.displayName}</h1>
                {member.position && member.position !== "MEMBER" && (
                  <span className="text-xs px-2 py-1 rounded font-medium" style={{ background: "#25547A", color: "#fff" }}>
                    {member.position === "PRESIDENT" ? "社长" : member.position === "VICE_PRESIDENT" ? "副社长" : member.position}
                  </span>
                )}
                {member.isActive ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(136,194,50,0.15)", color: "#88C232" }}>在读</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(136,194,50,0.08)", color: "#999" }}>已毕业</span>
                )}
              </div>
              <div className="text-sm space-y-1" style={{ color: "#777" }}>
                {member.grade && <p>{member.grade}{member.graduateYear ? ` · ${member.graduateYear} 年毕业` : ""}</p>}
                {!member.grade && member.graduateYear && <p>{member.graduateYear} 年毕业</p>}
              </div>

              {/* 职能标签 */}
              {member.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {member.skills.map((skill) => (
                    <span key={skill} className="text-xs px-2 py-0.5 rounded" style={{ background: "#E6F0F8", color: "#3388BB" }}>
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 个人简介 — 优先用成员 bio，兜底用户 bio */}
          {(member.bio || member.user?.bio) && (
            <div className="mb-10">
              <h2 className="text-xl font-semibold mb-3" style={{ color: "#25547A" }}>个人简介</h2>
              <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "#555" }}>
                {member.bio || member.user!.bio}
              </p>
            </div>
          )}

          {/* 参与项目 */}
          {member.projectMembers.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4" style={{ color: "#25547A" }}>
                参与项目 <span className="text-sm font-normal" style={{ color: "#999" }}>共 {member.projectMembers.length} 个</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {member.projectMembers.map(({ project, role }) => (
                  <Link
                    key={project.id}
                    href={`/works/${project.slug}`}
                    className="group flex gap-4 p-4 rounded-xl border bg-white hover:shadow-md transition-all"
                    style={{ borderColor: "#D0DEE8" }}
                  >
                    <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0" style={{ background: "#E6F0F8" }}>
                      {project.coverImage ? (
                        <Image src={project.coverImage} alt={project.title} width={80} height={56} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image src="/images/logo.png" alt="" width={20} height={20} className="opacity-30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold group-hover:text-[#3388BB] transition-colors truncate" style={{ color: "#333" }}>{project.title}</h3>
                      <p className="text-xs mt-1" style={{ color: "#777" }}>{role} · {project.developYear}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧边栏 */}
        <aside className="space-y-6">
          {/* 联系方式 — 敏感项，客户端判断可见性 */}
          <MemberContactInfo data={{
            location: member.location,
            phone: member.phone,
            wechat: member.wechat,
            qq: member.qq,
          }} />

          {/* 外部链接 */}
          {links.length > 0 && (
            <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
              <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>外部链接</h3>
              <div className="space-y-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors hover:bg-[#D0DEE8]"
                    style={{ color: "#333", background: "#E6F0F8" }}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                    <span className="ml-auto" style={{ color: "#999" }}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 信息摘要 */}
          <div className="rounded-xl p-5 border" style={{ background: "#F0F5F9", borderColor: "#D0DEE8" }}>
            <h3 className="font-semibold mb-3" style={{ color: "#25547A" }}>个人信息</h3>
            <dl className="space-y-2.5 text-sm">
              {member.graduateYear && <InfoRow label="毕业年份" value={String(member.graduateYear)} />}
              {member.grade && <InfoRow label="年级" value={member.grade} />}
              <InfoRow label="参与项目数" value={String(member.projectMembers.length)} />
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt style={{ color: "#777" }}>{label}</dt>
      <dd style={{ color: "#333" }}>{value}</dd>
    </div>
  );
}
