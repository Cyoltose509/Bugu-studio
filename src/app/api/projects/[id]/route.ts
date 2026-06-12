/**
 * 单个作品详情 API
 * GET    /api/projects/[id] - 获取作品详情
 * PATCH  /api/projects/[id] - 更新作品（提交者/Admin）
 * DELETE /api/projects/[id] - 删除作品（Admin）
 */

import {NextRequest} from "next/server";
import {revalidatePath} from "next/cache";
import {auth} from "@/lib/auth/auth";
import {prisma} from "@/lib/db/prisma";
import {projectUpdateSchema, reviewSchema} from "@/lib/validations";
import {canEditProject, isAdmin} from "@/lib/auth/rbac";
import {createAuditLog, extractRequestInfo} from "@/lib/utils/audit";
import {apiResponse, apiError, generateSlug} from "@/lib/utils";
import {invalidateCache} from "@/lib/db/cache";
import {createNotification, notifyNewProject, notifyProjectEdit, notifyMentions} from "@/lib/services/notification";
import {cachedQuery} from "@/lib/db/cache";
import {ProjectStatus} from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/[id]
export async function GET(request: NextRequest, {params}: RouteParams) {
    const {id} = await params;
    const session = await auth();

    const isAdminUser = isAdmin(session?.user?.role as any);

    const project = await cachedQuery(`api:project:${id}`, () =>
        prisma.project.findFirst({
            where: {
                OR: [{id}, {slug: id}],
                // 非管理员只能看已发布的
                ...(!isAdminUser && {status: ProjectStatus.PUBLISHED}),
            },
            include: {
                images: {orderBy: {sortOrder: "asc"}},
                tags: {include: {tag: true}},
                members: {
                    orderBy: {sortOrder: "asc"},
                    include: {
                        member: {
                            select: {
                                id: true,
                                displayName: true,
                                avatar: true,
                                grade: true,
                                userId: true,
                            },
                        },
                    },
                },
                submitter: {select: {id: true, name: true}},
                reviews: {
                    orderBy: {createdAt: "desc"},
                    take: 1,
                    include: {reviewer: {select: {name: true}}},
                },
            },
        }), 60);

    if (!project) return apiError("作品不存在", 404);

    return apiResponse(project);
}

// PATCH /api/projects/[id]
export async function PATCH(request: NextRequest, {params}: RouteParams) {
    const {id} = await params;
    const session = await auth();
    if (!session?.user) return apiError("请先登录", 401);

    const project = await prisma.project.findUnique({where: {id}});
    if (!project) return apiError("作品不存在", 404);

    if (
        !canEditProject(
            session.user.role as any,
            session.user.id,
            project.submitterId
        )
    ) {
        return apiError("权限不足", 403);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError("请求体格式错误", 400);
    }

    // 检查是否是审核操作（管理员专用）
    const reviewParsed = reviewSchema.safeParse(body);
    if (reviewParsed.success && isAdmin(session.user.role as any)) {
        const {approved, note} = reviewParsed.data;
        const updated = await prisma.$transaction([
            prisma.project.update({
                where: {id},
                data: {
                    status: approved ? ProjectStatus.PUBLISHED : ProjectStatus.REJECTED,
                    publishedAt: approved ? new Date() : null,
                    reviewNote: note,
                },
            }),
            prisma.review.create({
                data: {
                    projectId: id,
                    reviewerId: session.user.id,
                    approved,
                    note,
                },
            }),
        ]);

        // ── 通知提交者审核结果 ──
        const projectForNotif = await prisma.project.findUnique({
            where: {id},
            select: {title: true, submitterId: true},
        });
        if (projectForNotif) {
            await createNotification({
                userId: projectForNotif.submitterId,
                type: "PROJECT_REVIEW",
                title: approved ? "作品审核通过 ✅" : "作品审核未通过 ❌",
                content: `你的作品《${projectForNotif.title}》${approved ? "已通过审核并发布" : `被驳回：${note || "无备注"}`}`,
                relatedId: id,
                relatedType: "Project",
            });

            // ── 通知管理员 & 关注上新的成员 ──
            if (approved) {
                const submitter = await prisma.user.findUnique({
                    where: {id: projectForNotif.submitterId},
                    select: {name: true},
                });
                await notifyNewProject(id, projectForNotif.title, submitter?.name || "未知用户");
            }
        }

        const {ipAddress, userAgent} = extractRequestInfo(request);
        await createAuditLog({
            action: approved ? "PROJECT_APPROVE" : "PROJECT_REJECT",
            userId: session.user.id,
            targetType: "Project",
            targetId: id,
            ipAddress,
            userAgent,
            statusCode: 200,
        });

        // ── 清除缓存 & 触发页面刷新 ──
        const affectedMembers = await prisma.projectMember.findMany({
            where: {projectId: id},
            select: {memberId: true},
        });
        await Promise.all([
            invalidateCache("members:all"),
            invalidateCache("api:projects:"),
            invalidateCache("api:project:"),
            invalidateCache("works:sidebar:tags"),
            invalidateCache("works:count:"),
            invalidateCache("admin:projects:"),
            invalidateCache("admin:projectCount"),
            invalidateCache(`project:detail:${project.slug}`),
            ...affectedMembers.map(m => invalidateCache(`member:detail:${m.memberId}`)),
        ]);
        revalidatePath("/members");
        revalidatePath("/works");
        revalidatePath(`/works/${project.slug}`);
        revalidatePath("/admin/projects");

        return apiResponse(updated[0]);
    }

    // 普通更新
    const parsed = projectUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return apiError("数据验证失败", 422, parsed.error.flatten());
    }

    // ── REJECTED 项目被提交者编辑 → 自动改为 PENDING（重新提交） ──
    const isResubmit = project.status === ProjectStatus.REJECTED
        && project.submitterId === session.user.id
        && !isAdmin(session.user.role as any); // 管理员编辑时不触发

    // ── PUBLISHED 项目被提交者编辑 → 自动改为 PENDING（回到待审核） ──
    const isReEdit = project.status === ProjectStatus.PUBLISHED
        && project.submitterId === session.user.id
        && !isAdmin(session.user.role as any); // 管理员编辑时不触发

    const {tagIds, memberRoles, links, customTags, images, ...projectData} = parsed.data;

    // 处理自定义标签：upsert 新标签并合并到 tagIds
    let finalTagIds = tagIds;
    if (customTags !== undefined) {
        const customTagIds: string[] = [];
        for (const name of customTags) {
            const tagSlug = generateSlug(name);
            const tag = await prisma.tag.upsert({
                where: {name},
                update: {},
                create: {name, slug: tagSlug, color: "#88C232"},
                select: {id: true},
            });
            customTagIds.push(tag.id);
        }
        // 合并已有标签和自定义标签（去重）
        finalTagIds = [...(tagIds || []), ...customTagIds.filter((id) => !(tagIds || []).includes(id))];
    }

    const updated = await prisma.project.update({
        where: {id},
        data: {
            ...projectData,
            ...((isResubmit || isReEdit) && {status: ProjectStatus.PENDING}),
            ...(finalTagIds !== undefined && {
                tags: {
                    deleteMany: {},
                    create: finalTagIds.map((tagId) => ({tagId})),
                },
            }),
            ...(memberRoles !== undefined && {
                members: {
                    deleteMany: {},
                    create: memberRoles.map(({memberId, externalName, roles}, idx) => ({
                        memberId: memberId || null,
                        externalName: externalName || null,
                        roles,
                        sortOrder: idx,
                    })),
                },
            }),
            ...(links !== undefined && {
                links: {
                    deleteMany: {},
                    create: links.map((l, i) => ({
                        label: l.label,
                        url: l.url,
                        sortOrder: i,
                    })),
                },
            }),
            ...(images !== undefined && {
                images: {
                    deleteMany: {},
                    create: images.map((img, i) => ({
                        url: img.url,
                        altText: img.altText,
                        sortOrder: i,
                    })),
                },
            }),
        },
    });

    const {ipAddress, userAgent} = extractRequestInfo(request);
    await createAuditLog({
        action: "PROJECT_UPDATE",
        userId: session.user.id,
        targetType: "Project",
        targetId: id,
        ipAddress,
        userAgent,
        statusCode: 200,
    });

    // ── 重新提交时通知管理员 ──
    if (isResubmit) {
        const submitterName = session.user.name || "未知用户";
        await notifyNewProject(id, project.title, submitterName);
    }

    // ── 已发布作品编辑后通知提交者和管理员 ──
    if (isReEdit) {
        const submitterName = session.user.name || "未知用户";
        await notifyProjectEdit(id, updated.title, session.user.id, submitterName);
    }

    // ── @mention 通知 ──
    if (projectData.description) {
        await notifyMentions(projectData.description, session.user.name || "未知用户", session.user.id, {
            type: "Project",
            id: updated.slug, // 使用 slug 方便前端跳转
            title: updated.title,
        });
    }

    // ── 清除缓存（使用更新后的 slug，防止修改 slug 后缓存未命中）──
    await Promise.all([
        invalidateCache("members:all"),
        invalidateCache("api:projects:"),
        invalidateCache("api:project:"),
        invalidateCache("works:sidebar:tags"),
        invalidateCache("works:count:"),
        invalidateCache("admin:projects:"),
        invalidateCache("admin:projectCount"),
        invalidateCache(`project:detail:${updated.slug}`),
    ]);
    revalidatePath("/members");
    revalidatePath("/works");
    revalidatePath(`/works/${updated.slug}`);
    revalidatePath("/admin/projects");
    return apiResponse(updated);
}

// DELETE /api/projects/[id]
export async function DELETE(request: NextRequest, {params}: RouteParams) {
    const {id} = await params;
    const session = await auth();
    if (!session?.user) return apiError("请先登录", 401);
    if (!isAdmin(session.user.role as any)) return apiError("权限不足", 403);

    const project = await prisma.project.findUnique({where: {id}});
    if (!project) return apiError("作品不存在", 404);

    await prisma.project.delete({where: {id}});

    const {ipAddress, userAgent} = extractRequestInfo(request);
    await createAuditLog({
        action: "PROJECT_DELETE",
        userId: session.user.id,
        targetType: "Project",
        targetId: id,
        metadata: {title: project.title},
        ipAddress,
        userAgent,
        statusCode: 200,
    });

    // ── 清除缓存 ──
    await Promise.all([
        invalidateCache("members:all"),
        invalidateCache("api:projects:"),
        invalidateCache("api:project:"),
        invalidateCache("works:sidebar:tags"),
        invalidateCache("works:count:"),
        invalidateCache("admin:projects:"),
        invalidateCache("admin:projectCount"),
        invalidateCache(`project:detail:${project.slug}`),
    ]);
    revalidatePath("/members");
    revalidatePath("/works");
    revalidatePath(`/works/${project.slug}`);
    revalidatePath("/admin/projects");

    return apiResponse({deleted: true});
}
