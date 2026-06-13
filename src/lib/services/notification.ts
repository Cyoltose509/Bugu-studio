/**
 * 创建通知（安全版：不会因通知失败中断主流程）
 */
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedId?: string;
  relatedType?: string;
}) {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        relatedId: params.relatedId || null,
        relatedType: params.relatedType || null,
      },
    });
  } catch (err) {
    // 通知失败不影响主流程，仅静默记录
    console.error("[Notification] 创建失败:", err);
  }
}

/**
 * 批量创建通知（如角色变更、新作品通知等）
 */
export async function createNotifications(
  items: Array<{
    userId: string;
    type: string;
    title: string;
    content: string;
    relatedId?: string;
    relatedType?: string;
  }>
) {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.notification.createMany({
      data: items.map((item) => ({
        userId: item.userId,
        type: item.type,
        title: item.title,
        content: item.content,
        relatedId: item.relatedId || null,
        relatedType: item.relatedType || null,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error("[Notification] 批量创建失败:", err);
  }
}

/**
 * 作品上新通知：
 * - 通知所有管理员
 * - 通知所有开启"关注作品上新"的成员
 */
export async function notifyNewProject(projectId: string, projectTitle: string, submitterName: string) {
  try {
    const { prisma } = await import("@/lib/db/prisma");

    const [admins, notifMembers] = await Promise.all([
      prisma.user.findMany({ where: { role: "ADMIN", member: { graduated: false } }, select: { id: true } }),
      prisma.clubMember.findMany({
        where: { notifyNewProjects: true },
        select: { userId: true },
      }),
    ]);

    const items: Array<{
      userId: string; type: string; title: string;
      content: string; relatedId: string; relatedType: string;
    }> = [];

    for (const a of admins) {
      items.push({
        userId: a.id,
        type: "NEW_PROJECT",
        title: "有新作品待审核 🎮",
        content: `${submitterName} 提交了新作品《${projectTitle}》，请审核`,
        relatedId: projectId,
        relatedType: "Project",
      });
    }

    const notifUserIds = new Set(admins.map((a) => a.id));
    for (const m of notifMembers) {
      if (!notifUserIds.has(m.userId)) {
        items.push({
          userId: m.userId,
          type: "NEW_PROJECT",
          title: "有新的社团作品 🎮",
          content: `${submitterName} 发布了新作品《${projectTitle}》`,
          relatedId: projectId,
          relatedType: "Project",
        });
      }
    }

    if (items.length > 0) {
      await prisma.notification.createMany({
        data: items,
        skipDuplicates: true,
      });
    }
  } catch (err) {
    console.error("[Notification] 作品上新通知失败:", err);
  }
}

/**
 * 作品编辑后通知（已发布作品被编辑 → 回到待审核）
 * - 通知提交者：你的作品已更新，等待重新审核
 * - 通知所有在线管理员（排除已毕业）
 */
export async function notifyProjectEdit(projectId: string, projectTitle: string, submitterId: string, submitterName: string) {
  try {
    const { prisma } = await import("@/lib/db/prisma");

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", member: { graduated: false } },
      select: { id: true },
    });

    const items: Array<{
      userId: string; type: string; title: string;
      content: string; relatedId: string; relatedType: string;
    }> = [
      {
        userId: submitterId,
        type: "PROJECT_UPDATE",
        title: "作品已更新，等待重新审核",
        content: `你的作品《${projectTitle}》已更新，等待管理员重新审核`,
        relatedId: projectId,
        relatedType: "Project",
      },
    ];

    for (const a of admins) {
      items.push({
        userId: a.id,
        type: "PROJECT_UPDATE",
        title: "作品更新待审",
        content: `${submitterName} 更新了作品《${projectTitle}》，需要重新审核`,
        relatedId: projectId,
        relatedType: "Project",
      });
    }

    if (items.length > 0) {
      await prisma.notification.createMany({
        data: items,
        skipDuplicates: true,
      });
    }
  } catch (err) {
    console.error("[Notification] 作品编辑通知失败:", err);
  }
}

/**
 * @mention 通知 — 检测内容中的 @成员，给被提及的人发送通知
 * @param content - 包含 @mention 的文本内容
 * @param fromName - 发起人的显示名
 * @param fromUserId - 发起人的 userId（不会给自己发通知）
 * @param context - 上下文信息
 */
export async function notifyMentions(
  content: string,
  fromName: string,
  fromUserId: string,
  context: {
    type: "Project" | "Activity" | "HistoryEvent";
    id: string;
    title: string;
  }
) {
  try {
    const { prisma } = await import("@/lib/db/prisma");

    // 步骤1：提取新版 @displayName(memberId) → 直接拿 memberId
    const newMentionRe = /@([^(]+)\(([a-zA-Z0-9_]+)\)/g;
    const memberIds = new Set<string>();
    let m;
    while ((m = newMentionRe.exec(content)) !== null) {
      memberIds.add(m[2]);
    }

    // 步骤2：提取旧版 @displayName（排除已被新版覆盖的）
    const plainMentionRe = /@([^\s@]+)/g;
    const mentionedNames = new Set<string>();
    while ((m = plainMentionRe.exec(content)) !== null) {
      // 检查这个位置是否已被新版格式覆盖
      const isInNew = [...newMentionRe.exec(content) || []]; // 重置
      mentionedNames.add(m[1]);
    }
    // 更精确的方法：先标记新版 mention 覆盖范围
    const newMentionSpans: Array<{ start: number; end: number }> = [];
    const nmRe = /@([^(]+)\(([a-zA-Z0-9_]+)\)/g;
    let nm;
    while ((nm = nmRe.exec(content)) !== null) {
      newMentionSpans.push({ start: nm.index, end: nmRe.lastIndex });
    }
    const pmRe = /@([^\s@]+)/g;
    let pm;
    while ((pm = pmRe.exec(content)) !== null) {
      const inNew = newMentionSpans.some(s => pm!.index >= s.start && pm!.index < s.end);
      if (!inNew) {
        mentionedNames.add(pm[1]);
      }
    }

    if (memberIds.size === 0 && mentionedNames.size === 0) return;

    // 按 memberId 精确查找（新版格式，不受改名影响）
    const membersById = memberIds.size > 0
      ? await prisma.clubMember.findMany({
          where: {
            id: { in: [...memberIds] },
            user: { id: { not: fromUserId } },
          },
          select: { userId: true, displayName: true },
        })
      : [];

    // 按 displayName 查找（旧版格式，排除已通过 ID 找到的）
    const foundUserIds = new Set(membersById.map(m => m.userId));
    const membersByName = mentionedNames.size > 0
      ? await prisma.clubMember.findMany({
          where: {
            displayName: { in: [...mentionedNames] },
            user: { id: { not: fromUserId } },
            ...(foundUserIds.size > 0 ? { userId: { notIn: [...foundUserIds] } } : {}),
          },
          select: { userId: true, displayName: true },
        })
      : [];

    const allMembers = [...membersById, ...membersByName];
    if (allMembers.length === 0) return;

    const relatedTypeMap: Record<string, string> = {
      Project: "Project",
      Activity: "Activity",
      HistoryEvent: "HistoryEvent",
    };

    const items = allMembers.map((member) => ({
      userId: member.userId,
      type: "MENTION",
      title: `${fromName} 在${contextTitle(context.type)}中 @你`,
      content: `${fromName} 在《${context.title}》中提到了你`,
      relatedId: context.id,
      relatedType: relatedTypeMap[context.type] || context.type,
    }));

    await prisma.notification.createMany({
      data: items,
      skipDuplicates: true,
    });
  } catch (err) {
    console.error("[Notification] @mention 通知失败:", err);
  }
}

function contextTitle(type: string): string {
  switch (type) {
    case "Project": return "作品";
    case "Activity": return "活动";
    case "HistoryEvent": return "历史事件";
    default: return "内容";
  }
}
