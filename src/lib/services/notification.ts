/**
 * 新通知入库后立即清理对应用户的通知列表缓存和未读数缓存，
 * 避免管理员刚打开过通知铃铛时新提交的作品要等缓存过期才出现。
 */
async function invalidateNotificationCaches(userIds: Iterable<string>) {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;
  try {
    const [{ invalidateCache }, { invalidateUnreadCache }] = await Promise.all([
      import("@/lib/db/cache"),
      import("@/lib/cache/unread-count-cache"),
    ]);
    await Promise.all(
      uniqueIds.flatMap((uid) => {
        invalidateUnreadCache(uid);
        return [
          invalidateCache(`api:notifications:${uid}`),
          invalidateCache(`notifications:${uid}`),
        ];
      }),
    );
  } catch (err) {
    console.error("[Notification] 清理通知缓存失败:", err);
  }
}

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
    await invalidateNotificationCaches([params.userId]);
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
    await invalidateNotificationCaches(items.map((item) => item.userId));
  } catch (err) {
    console.error("[Notification] 批量创建失败:", err);
  }
}

/** 作品通知的公共上下文：谁提交的、谁在操作。 */
export interface ProjectNotifyContext {
  projectId: string;
  projectTitle: string;
  /** 作品归属者（Project.submitterId） */
  submitterId: string;
  submitterName: string;
  /** 实际点下按钮的人。管理员代提交/代编辑时它和 submitterId 不同 */
  actorId?: string;
  actorName?: string;
}

/** 通知里给「操作者」用的名字，缺省回落到提交者名。 */
function actorOf(ctx: ProjectNotifyContext) {
  return {
    id: ctx.actorId || ctx.submitterId,
    name: ctx.actorName || ctx.submitterName,
  };
}

/**
 * 列出作品里的其他作者（排除提交者本人与操作者）。
 * 管理员代提交时，被代投的成员才是真正作者，理应知道作品进了审核。
 */
async function otherAuthorIds(projectId: string, exclude: Set<string>) {
  const { prisma } = await import("@/lib/db/prisma");
  const rows = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true, member: { select: { userId: true } } },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    const userId = row.userId || row.member?.userId;
    if (userId && !exclude.has(userId)) ids.add(userId);
  }
  return [...ids];
}

/**
 * 提交 → 待审核通知。
 *
 * 只发给「需要处理的人」和「被代投的作者」：
 * - 管理员：排除操作者本人（管理员代提交时不该收到自己的「请审核」）
 * - 作品其他作者：排除提交者与操作者
 * - 关注上新的成员：不发。作品还在待审核，说「已发布」是错的；
 *   发布成功由 notifyProjectPublished 负责。
 */
export async function notifyNewProject(
  ctx: ProjectNotifyContext,
  opts?: { origin?: "club" | "jam" }
) {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const actor = actorOf(ctx);
    const skip = new Set([actor.id, ctx.submitterId]);

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    const content =
      opts?.origin === "jam"
        ? `${ctx.submitterName} 把 Game Jam 参赛作品《${ctx.projectTitle}》转入了作品库，请审核`
        : `${ctx.submitterName} 提交了新作品《${ctx.projectTitle}》，请审核`;

    const items: Array<{
      userId: string; type: string; title: string;
      content: string; relatedId: string; relatedType: string;
    }> = [];

    for (const a of admins) {
      if (skip.has(a.id)) continue;
      items.push({
        userId: a.id,
        type: "NEW_PROJECT",
        title: "有新作品待审核 🎮",
        content,
        relatedId: ctx.projectId,
        relatedType: "Project",
      });
    }

    const authors = await otherAuthorIds(
      ctx.projectId,
      new Set([...skip, ...admins.map((a) => a.id)])
    );
    for (const userId of authors) {
      items.push({
        userId,
        type: "PROJECT_SUBMIT_ACK",
        title: "你参与的作品已提交",
        content: `${actor.name} 提交了《${ctx.projectTitle}》，等待管理员审核`,
        relatedId: ctx.projectId,
        relatedType: "Project",
      });
    }

    if (items.length > 0) {
      await prisma.notification.createMany({
        data: items,
        skipDuplicates: true,
      });
      await invalidateNotificationCaches(items.map((item) => item.userId));
    }
  } catch (err) {
    console.error("[Notification] 作品上新通知失败:", err);
  }
}

/**
 * 作品正式发布通知 —— 只通知关注上新的成员。
 *
 * 用在「审核通过」这一步：作品已经审核完了，再给管理员发「有新作品待审核」
 * 只会把已经处理掉的活儿重新标成待办。提交者自己的订阅不该弹自己的作品。
 */
export async function notifyProjectPublished(
  projectId: string,
  projectTitle: string,
  submitterName: string,
  opts?: { excludeUserIds?: string[] }
) {
  try {
    const { prisma } = await import("@/lib/db/prisma");

    const notifMembers = await prisma.clubMember.findMany({
      where: { notifyNewProjects: true },
      select: { userId: true },
    });
    const skip = new Set(opts?.excludeUserIds || []);
    const targets = notifMembers.filter((m) => !skip.has(m.userId));
    if (targets.length === 0) return;

    await prisma.notification.createMany({
      data: targets.map((m) => ({
        userId: m.userId,
        type: "PROJECT_PUBLISHED",
        title: "有新的社团作品 🎮",
        content: `${submitterName} 发布了新作品《${projectTitle}》`,
        relatedId: projectId,
        relatedType: "Project",
      })),
      skipDuplicates: true,
    });
    await invalidateNotificationCaches(targets.map((m) => m.userId));
  } catch (err) {
    console.error("[Notification] 作品发布通知失败:", err);
  }
}

/**
 * 作品编辑后通知（已发布作品被编辑 → 回到待审核）
 * - 提交者：作品已更新，等待重新审核（操作者就是提交者时不发，没必要通知自己）
 * - 其他管理员：作品更新待审（排除操作者与提交者）
 */
export async function notifyProjectEdit(ctx: ProjectNotifyContext) {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const actor = actorOf(ctx);
    const skip = new Set([actor.id, ctx.submitterId]);

    const items: Array<{
      userId: string; type: string; title: string;
      content: string; relatedId: string; relatedType: string;
    }> = [];

    if (ctx.submitterId !== actor.id) {
      items.push({
        userId: ctx.submitterId,
        type: "PROJECT_RESUBMIT",
        title: "作品已更新，等待重新审核",
        content: `你的作品《${ctx.projectTitle}》已被 ${actor.name} 更新，等待管理员重新审核`,
        relatedId: ctx.projectId,
        relatedType: "Project",
      });
    }

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    for (const a of admins) {
      if (skip.has(a.id)) continue;
      items.push({
        userId: a.id,
        type: "PROJECT_UPDATE",
        title: "作品更新待审",
        content: `${actor.name} 更新了作品《${ctx.projectTitle}》，需要重新审核`,
        relatedId: ctx.projectId,
        relatedType: "Project",
      });
    }

    if (items.length > 0) {
      await prisma.notification.createMany({
        data: items,
        skipDuplicates: true,
      });
      await invalidateNotificationCaches(items.map((item) => item.userId));
    }
  } catch (err) {
    console.error("[Notification] 作品编辑通知失败:", err);
  }
}

/**
 * 审核结果通知 —— 只发给提交者。
 *
 * 审核人自己就是提交者时（管理员审自己的作品）直接跳过：给自己发
 * 「你的作品已通过审核」没有任何意义。
 */
export async function notifyProjectReviewResult(params: {
  projectId: string;
  projectTitle: string;
  submitterId: string;
  approved: boolean;
  note?: string | null;
  /** 重新审核通过（编辑后复审）时文案略有不同 */
  reReview?: boolean;
  reviewerId?: string;
}) {
  if (params.reviewerId && params.reviewerId === params.submitterId) return;

  const verb = params.approved
    ? params.reReview
      ? "重新审核通过"
      : "审核通过"
    : "审核未通过";

  await createNotification({
    userId: params.submitterId,
    type: "PROJECT_REVIEW",
    title: params.approved ? `作品${verb} ✅` : `作品${verb} ❌`,
    content: params.approved
      ? `你的作品《${params.projectTitle}》已${verb}，现在可以在社团主页公开展示了`
      : `你的作品《${params.projectTitle}》未通过审核${params.note ? `：${params.note}` : "，你可以修改后重新提交"}`,
    relatedId: params.projectId,
    relatedType: "Project",
  });
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
