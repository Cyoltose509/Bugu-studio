/**
 * 数据迁移脚本：
 * 1. 创建 Steam / Itch 平台标签
 * 2. 将旧作品类型映射为新类型：DEMO+ITCH → TRIAL_DEMO, STEAM → OFFICIAL_RELEASE
 * 3. 自动为 Steam/Itch 类型作品打上对应平台标签
 * 4. 将所有 REVIEWER 用户升级为 ADMIN
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== 开始数据迁移 ===\n");

  // ── 1. 创建 Steam / Itch 平台标签 ──
  console.log("1. 创建平台标签...");
  const steamTag = await prisma.tag.upsert({
    where: { slug: "platform-steam" },
    update: {},
    create: { name: "Steam", slug: "platform-steam", color: "#1B2838", group: "平台", sortOrder: 100 },
  });
  const itchTag = await prisma.tag.upsert({
    where: { slug: "platform-itch" },
    update: {},
    create: { name: "Itch", slug: "platform-itch", color: "#FA5C5C", group: "平台", sortOrder: 101 },
  });
  console.log(`  Steam 标签: ${steamTag.id}`);
  console.log(`  Itch 标签: ${itchTag.id}\n`);

  // ── 2. 迁移作品类型 ──
  console.log("2. 迁移作品类型...");

  // DEMO → TRIAL_DEMO
  const demos = await prisma.project.updateMany({
    where: { type: "DEMO" as any },
    data: { type: "TRIAL_DEMO" as any },
  });
  console.log(`  DEMO → TRIAL_DEMO: ${demos.count} 条`);

  // ITCH → TRIAL_DEMO
  const itch = await prisma.project.updateMany({
    where: { type: "ITCH" as any },
    data: { type: "TRIAL_DEMO" as any },
  });
  console.log(`  ITCH → TRIAL_DEMO: ${itch.count} 条`);

  // STEAM → OFFICIAL_RELEASE
  const steam = await prisma.project.updateMany({
    where: { type: "STEAM" as any },
    data: { type: "OFFICIAL_RELEASE" as any },
  });
  console.log(`  STEAM → OFFICIAL_RELEASE: ${steam.count} 条`);

  // OTHER → IN_DEVELOPMENT (默认)
  const other = await prisma.project.updateMany({
    where: { type: "OTHER" as any },
    data: { type: "IN_DEVELOPMENT" as any },
  });
  console.log(`  OTHER → IN_DEVELOPMENT: ${other.count} 条\n`);

  // ── 3. 自动打平台标签 ──
  console.log("3. 打平台标签...");
  // 查找所有原本是 STEAM 类型的作品（现在 type = OFFICIAL_RELEASE）
  // 因为类型已变更，需要根据是否已有 Steam/itch.io 链接来判断
  // 更好的方式：根据 ProjectLink 中的链接来判断
  const projectsWithLinks = await prisma.project.findMany({
    where: {
      links: {
        some: {
          label: { in: ["Steam", "steam", "Itch", "itch", "itch.io"], mode: "insensitive" },
        },
      },
    },
    select: { id: true, links: { select: { label: true } } },
  });

  for (const p of projectsWithLinks) {
    const hasSteamLink = p.links.some((l) => /steam/i.test(l.label));
    const hasItchLink = p.links.some((l) => /itch/i.test(l.label));

    const tagIds: string[] = [];
    if (hasSteamLink) tagIds.push(steamTag.id);
    if (hasItchLink) tagIds.push(itchTag.id);

    for (const tagId of tagIds) {
      await prisma.projectTag.upsert({
        where: { projectId_tagId: { projectId: p.id, tagId } },
        update: {},
        create: { projectId: p.id, tagId },
      });
    }
  }
  console.log(`  已为 ${projectsWithLinks.length} 个作品自动打上平台标签\n`);

  // ── 4. 将所有 REVIEWER 用户升级为 ADMIN ──
  console.log("4. 升级 REVIEWER 用户...");
  const reviewers = await prisma.user.updateMany({
    where: { role: "REVIEWER" as any },
    data: { role: "ADMIN" as any },
  });
  console.log(`  已升级: ${reviewers.count} 个用户\n`);

  // 同样处理 InviteCode 中的 REVIEWER 角色
  const reviewerInvites = await prisma.inviteCode.updateMany({
    where: { role: "REVIEWER" as any },
    data: { role: "ADMIN" as any },
  });
  console.log(`  已更新邀请码: ${reviewerInvites.count} 个\n`);

  console.log("=== 迁移完成 ===");
}

main()
  .catch((e) => {
    console.error("迁移失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
