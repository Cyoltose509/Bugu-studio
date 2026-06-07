/**
 * 作品详情页
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ProjectStatus } from "@prisma/client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await prisma.project.findFirst({
    where: { OR: [{ slug }, { id: slug }], status: ProjectStatus.PUBLISHED },
    select: { title: true, description: true, coverImage: true },
  });

  if (!project) return { title: "作品不存在" };

  return {
    title: project.title,
    description: project.description.slice(0, 160),
    openGraph: {
      images: project.coverImage ? [project.coverImage] : [],
    },
  };
}

export default async function WorkDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const project = await prisma.project.findFirst({
    where: { OR: [{ slug }, { id: slug }], status: ProjectStatus.PUBLISHED },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      members: {
        orderBy: { sortOrder: "asc" },
        include: {
          member: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              grade: true,
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const externalLinks = [
    { label: "Steam", url: project.steamUrl, emoji: "🎮" },
    { label: "GitHub", url: project.githubUrl, emoji: "💻" },
    { label: "Itch.io", url: project.itchUrl, emoji: "🕹️" },
    { label: "网盘下载", url: project.panUrl, emoji: "📦" },
    { label: "Google Drive", url: project.driveUrl, emoji: "📁" },
    { label: "OneDrive", url: project.onedriveUrl, emoji: "☁️" },
    { label: "视频演示", url: project.videoUrl, emoji: "▶️" },
    { label: "官方网站", url: project.websiteUrl, emoji: "🌐" },
  ].filter((l) => l.url);

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      {/* 面包屑 */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/works" className="hover:text-white">作品库</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-300">{project.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 左侧主内容 */}
        <div className="lg:col-span-2">
          {/* 封面 */}
          {project.coverImage && (
            <div className="relative aspect-video w-full rounded-xl overflow-hidden mb-6">
              <Image
                src={project.coverImage}
                alt={project.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          <h1 className="text-3xl font-bold text-white mb-2">{project.title}</h1>
          {project.subtitle && (
            <p className="text-gray-400 text-lg mb-4">{project.subtitle}</p>
          )}

          {/* 标签 */}
          <div className="flex flex-wrap gap-2 mb-6">
            {project.tags.map(({ tag }) => (
              <Link
                key={tag.slug}
                href={`/works?tag=${tag.slug}`}
                className="text-sm px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </Link>
            ))}
          </div>

          {/* 简介 */}
          <div className="prose prose-invert max-w-none mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">作品简介</h2>
            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* 截图画廊 */}
          {project.images.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">游戏截图</h2>
              <div className="grid grid-cols-2 gap-3">
                {project.images.map((img) => (
                  <div key={img.id} className="relative aspect-video rounded-lg overflow-hidden">
                    <Image
                      src={img.url}
                      alt={img.altText || project.title}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 开发日志 */}
          {project.devlog && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">开发日志</h2>
              <div className="bg-gray-900 rounded-xl p-6 text-gray-300 whitespace-pre-wrap leading-relaxed border border-white/10">
                {project.devlog}
              </div>
            </div>
          )}
        </div>

        {/* 右侧信息栏 */}
        <aside className="space-y-6">
          {/* 外部链接 */}
          {externalLinks.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5 border border-white/10">
              <h3 className="font-semibold text-white mb-3">获取游戏</h3>
              <div className="space-y-2">
                {externalLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
                  >
                    <span>{link.emoji}</span>
                    <span>{link.label}</span>
                    <span className="ml-auto text-gray-500">↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 项目信息 */}
          <div className="bg-gray-900 rounded-xl p-5 border border-white/10">
            <h3 className="font-semibold text-white mb-3">项目信息</h3>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="类型" value={project.type} />
              <InfoRow label="开发年份" value={String(project.developYear)} />
              {project.techStack.length > 0 && (
                <div>
                  <dt className="text-gray-500 mb-1">技术栈</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {project.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded"
                      >
                        {tech}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* 开发团队 */}
          {project.members.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5 border border-white/10">
              <h3 className="font-semibold text-white mb-3">开发团队</h3>
              <div className="space-y-3">
                {project.members.map(({ member, role }) => (
                  <Link
                    key={member.id}
                    href={`/members/${member.id}`}
                    className="flex items-center gap-3 hover:bg-white/5 rounded-lg p-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                      {member.avatar ? (
                        <Image
                          src={member.avatar}
                          alt={member.displayName}
                          width={36}
                          height={36}
                        />
                      ) : (
                        member.displayName[0]
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-white">{member.displayName}</div>
                      <div className="text-xs text-gray-500">{role}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-200">{value}</dd>
    </div>
  );
}
